import OTTrackerCtrl from './ot_tracker_controller';
import OTTriggerCtrl from './ot_trigger_controller';
import OTItemCtrl from './ot_item_controller';
import UserBelongingCtrl from './user_belongings_base';
import C from "../server_consts";
import app from '../app';
import { SocketConstants } from '../../omnitrack/core/research/socket';

export default class OTSyncCtrl {

  constructor(private trackerCtrl: OTTrackerCtrl, private triggerCtrl: OTTriggerCtrl, private itemCtrl: OTItemCtrl) {

  }

  batchGetServerChangesAfter = (req, res) => {
    try {
      const userId = req.user.uid
      const typeCount = req.query.types.length
      const queryList = Array<{ type: string, timestamp: number }>()

      for (let i = 0; i < typeCount; i++) {
        queryList.push({ type: req.query.types[i].toString(), timestamp: req.query.timestamps[i] * 1 })
      }

      Promise.all(
        queryList.map(entry => {
          let controller: UserBelongingCtrl
          switch (entry.type.toUpperCase()) {
            case C.SYNC_TYPE_TRACKER:
              controller = this.trackerCtrl
              break
            case C.SYNC_TYPE_TRIGGER:
              controller = this.triggerCtrl
              break
            case C.SYNC_TYPE_ITEM:
              controller = this.itemCtrl
              break
          }

          if (controller != null) {
            return controller.getAllByUserOverTimestampQuery(userId, entry.timestamp).then(l => ({ type: entry.type, list: l }))
          } else { return Promise.resolve({ type: entry.type, list: [] }) }
        })
      ).then(
        results => {
          return results.reduce(function (map, obj) {
            map[obj.type] = obj.list
            return map
          }, {})
        }
      ).then(
        result => {
          res.status(200).send(result)
        }
      )

    } catch (ex) {
      console.log(ex)
      res.status(500).send({ error: ex })
    }
  }

  batchPostClientChanges = (req, res) => {
    try {
      const userId = req.user.uid
      const clientChangeList: Array<{ type: string, rows: Array<any> }> = req.body

      Promise.all(clientChangeList.map(
        entry => {
          let controller: UserBelongingCtrl
          switch (entry.type.toUpperCase()) {
            case C.SYNC_TYPE_TRACKER:
              controller = this.trackerCtrl
              break
            case C.SYNC_TYPE_TRIGGER:
              controller = this.triggerCtrl
              break
            case C.SYNC_TYPE_ITEM:
              controller = this.itemCtrl
              break
          }

          if (controller == null) {
            return Promise.resolve({ type: entry.type, rows: [] })
          } else {
            return controller.applyClientChanges(userId, entry.rows.map(str => {
              try {
                return JSON.parse(str)
              } catch (ex) {
                console.error("JSON parsing error during synchronization:")
                console.error(str)
                console.error(ex)
                throw ex
              }
            })).then(result => ({ type: entry.type, rows: result }))
          }
        }
      )
      ).then(results => {
        console.log("bulk result: ")
        console.log(results)
        const changedTypes = results.filter(r => r.rows.length > 0).map(r => r.type)

        // Send sync notification to devices
        app.pushModule().sendSyncDataMessageToUser(userId, changedTypes, { excludeDeviceIds: [req.get("OTDeviceId")] })
          .then().catch()

        const experimentId = req.get("OTExperiment")
        if (experimentId != null) {
          changedTypes.forEach(changedType => {
            let eventName: string
            switch (changedType) {
              case C.SYNC_TYPE_ITEM: eventName = SocketConstants.SOCKET_MESSAGE_UPDATED_ITEMS
                break;
              case C.SYNC_TYPE_TRACKER: eventName = SocketConstants.SOCKET_MESSAGE_UPDATED_TRACKERS
                break;
              case C.SYNC_TYPE_TRIGGER: eventName = SocketConstants.SOCKET_MESSAGE_UPDATED_TRIGGERS
                break;
            }

            app.socketModule().sendDataToExperimentSubscribers(experimentId, eventName, null)
          })
        }

        return results.reduce(function (map, obj) {
          map[obj.type] = obj.rows
          return map
        }, {})
      }).then(result => {
        console.log(result)
        res.status(200).send(result)
      })

    } catch (ex) {
      console.log(ex)
      res.status(500).send({ error: ex })
    }
  }
}
