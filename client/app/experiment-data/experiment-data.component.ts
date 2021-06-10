import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from "@angular/core";
import { Subscription, Observable } from "rxjs";
import { ResearchApiService } from "../services/research-api.service";
import { NotificationService } from "../services/notification.service";
import {
  ITrackerDbEntity,
  IItemDbEntity,
  IFieldDbEntity,
  IUserDbEntity
} from "../../../omnitrack/core/db-entity-types";
import TypedStringSerializer from "../../../omnitrack/core/typed_string_serializer";
import FieldManager from "../../../omnitrack/core/fields/field.manager";
import { MatDialog } from '@angular/material';

import fieldTypes from "../../../omnitrack/core/fields/field-types";
import { SingletonAudioPlayerServiceService } from "../services/singleton-audio-player-service.service";
import { aliasCompareFunc } from "../../../shared_lib/utils";
import * as moment from 'moment-timezone';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';
import { UpdateItemCellValueDialogComponent } from "../dialogs/update-item-cell-value-dialog/update-item-cell-value-dialog.component";
import { TimePoint } from "../../../omnitrack/core/datatypes/field_datatypes";
import { zip } from 'rxjs';
import { tap, flatMap, map } from 'rxjs/operators';
import { trigger, transition, style, animate } from "@angular/animations";
const snakeCase = require('snake-case');

enum CellValueType {
  DATETIME_SECONDS = "seconds",
  DATETIME_MINUTES = "minutes",
  DATE = "date",
  CUSTOM = "custom",
  ENUM = "enum"
}

const METADATA_VALUE_TYPE_TABLE = {
  pivotDate: CellValueType.DATE,
  conditionType: CellValueType.ENUM,
  reservedAt: CellValueType.DATETIME_SECONDS,
  actuallyFiredAt: CellValueType.DATETIME_SECONDS,
  screenAccessedAt: CellValueType.DATETIME_SECONDS,
  accessedDirectlyFromReminder: CellValueType.ENUM,
  pairedToReminder: CellValueType.ENUM,
  ModalityChoice: CellValueType.CUSTOM
}

@Component({
  selector: "app-experiment-data",
  templateUrl: "./experiment-data.component.html",
  styleUrls: ["./experiment-data.component.scss"],
  providers: [SingletonAudioPlayerServiceService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('rowShowHideTrigger', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(50%)'}),
        animate('0.5s ease-in-out', style({ opacity: 1, transform: "*"})),
      ]),
      transition(':leave', [
        animate('0.3s ease-in-out', style({ opacity: 0, transform: 'translateX(50%)'}))
      ])
    ])
  ]
})
export class ExperimentDataComponent implements OnInit, OnDestroy {
  private readonly _internalSubscriptions = new Subscription();

  public printFriendlyMode = false

  public showMetadata = true

  private userSubscriptions = new Subscription();
  private trackerSubscriptions = new Subscription();

  public participants: Array<IUserDbEntity>;

  public selectedParticipantId: string;
  public selectedTracker: ITrackerDbEntity;

  public selectedTrackerIndex = 0;

  public userTrackers: Array<ITrackerDbEntity> = [];

  public trackerItems: Array<IItemDbEntity> = [];

  public metadataColumns: Array<string> = [];

  public screenExpanded = true

  public animateEnterLeaveAnimation = false

  constructor(
    private api: ResearchApiService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    private detector: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.notificationService.registerGlobalBusyTag(
      "participantsInDataComponent"
    );
    this._internalSubscriptions.add(
      this.api.selectedExperimentService
        .pipe(tap(service => {
          service.trackingDataService.registerConsumer(
            "experimentDataComponent"
          );
        }),
          flatMap(service => service.getActiveParticipants())
        )
        .subscribe(participants => {
          /*
          participants.sort((a,b)=>{return new Date(a.experimentRange.from).getTime() - new Date(b.experimentRange.from).getTime()})*/
          const sortFunc = aliasCompareFunc(false)
          participants.sort((a, b) => sortFunc(a.participationInfo.alias, b.participationInfo.alias))
          this.participants = participants;
          if (this.participants.length > 0) {
            this.selectedParticipantId = this.participants[0]._id;
            this.onSelectedParticipantIdChanged(this.selectedParticipantId);
          }
          this.notificationService.unregisterGlobalBusyTag(
            "participantsInDataComponent"
          );

          this.animateEnterLeaveAnimation = true
          this.detector.markForCheck()
        })
    );
  }

  ngOnDestroy(): void {
    if (this.api.selectedExperimentServiceSync) {
      this.api.selectedExperimentServiceSync.trackingDataService.unregisterConsumer(
        "experimentDataComponent"
      );
    }
    this._internalSubscriptions.unsubscribe();
    this.userSubscriptions.unsubscribe();
  }

  trackDbObject(index, obj) {
    return obj._id
  }

  trackFields(index, field: IFieldDbEntity){
    return field.localId
  }

  onExpandButtonClicked() {
    this.screenExpanded = !this.screenExpanded
  }

  onParticipantSelectionChanged(event) {
    this.onSelectedParticipantIdChanged(this.selectedParticipantId)
  }


  onTrackerTabChanged(event) {
    this.onSelectedTrackerChanged(this.userTrackers[event.index]);
  }

  private onSelectedParticipantIdChanged(newParticipantId: string) {
    this.userSubscriptions.unsubscribe();
    this.userSubscriptions = new Subscription();
    this.userSubscriptions.add(
      this.api.selectedExperimentService
        .pipe(flatMap(service =>
          service.trackingDataService.getTrackersOfUser(newParticipantId)
        ))
        .subscribe(trackers => {
          this.userTrackers = trackers;
          const selectedTrackerIndex = Math.max(
            0,
            Math.min(trackers.length - 1, this.selectedTrackerIndex)
          );
          this.onSelectedTrackerChanged(this.userTrackers[selectedTrackerIndex]);
        })
    );
  }

  private onSelectedTrackerChanged(tracker: ITrackerDbEntity) {
    if (this.selectedTracker !== tracker) {
      this.selectedTracker = tracker;

      this.trackerSubscriptions.unsubscribe();
      this.trackerSubscriptions = new Subscription();
      if (tracker != null) {
        this.trackerSubscriptions.add(
          this.api.selectedExperimentService.pipe(
            flatMap(service =>
              service.trackingDataService.getItemsOfTracker(tracker._id)
            ))
            .subscribe(items => {
              this.trackerItems = items;

              this.metadataColumns = []
              for (const item of items) {
                if (item.metadata != null) {
                  for (const key of Object.keys(item.metadata)) {
                    if (this.metadataColumns.indexOf(key) === -1) {
                      this.metadataColumns.push(key)
                    }
                  }
                }
              }

              this.animateEnterLeaveAnimation = false
              this.detector.markForCheck()
            })
        );
      }
    }
  }

  styleMetadataKeyString(key: string): string {
    return snakeCase(key.replace(/^returned::/g, "")).replace(/_/g, " ")
  }

  getMetadataCellType(key: string): string {
    return METADATA_VALUE_TYPE_TABLE[key] || CellValueType.CUSTOM
  }

  getMetadataValue(item: IItemDbEntity, metadataKey: string): any {
    if (item.metadata != null) {
      const value = item.metadata[metadataKey]
      if (value != null) {
        switch (this.getMetadataCellType(metadataKey)) {
          case CellValueType.DATE: return new TimePoint(value, item.timezone).toMoment().format("YYYY-MM-DD")
          case CellValueType.DATETIME_MINUTES: return new TimePoint(value, item.timezone).toMoment().format("kk:mm (MMM DD YYYY)") + " " + moment.tz(item.timezone).format("z")
          case CellValueType.DATETIME_SECONDS: return new TimePoint(value, item.timezone).toMoment().format("kk:mm:ss (MMM DD YYYY)") + " " + moment.tz(item.timezone).format("z")
          case CellValueType.CUSTOM: return this.getModalityChoice(value)
          default: return value
        }
      } else return null

    } else return null
  }

  getModalityChoice(rawData: JSON): string {
     //const filteredData = _.omit('Id', rawData)
    //const filteredData = filterObject(rawData, 'Id')
    let i = 0
    Object.keys(rawData).forEach(function(key){
          delete rawData[i].Id
          delete rawData[i].type
          delete rawData[i].succeed
          i ++
    })

    var processedData = JSON.stringify(rawData)
    const size = processedData.length
    processedData = processedData.substring(1, size-1)
    processedData = processedData.replace(/['"]+/g, '')

    const originalSeparator = "},{"
    const newSeparator = "}-->{"

    var displayStr = processedData.replaceAll(originalSeparator, newSeparator)
    displayStr = displayStr.split(',').join(', ')

    return displayStr
  }

  getItemCountOfTracker(trackerId: string): Observable<number> {
    return this.api.selectedExperimentService.pipe(
      flatMap(service =>
        service.trackingDataService.getItemsOfTracker(trackerId)),
      map(items => items.length)
    )
  }

  isImageField(attr: IFieldDbEntity): boolean {
    return attr.type === fieldTypes.ATTR_TYPE_IMAGE
  }

  getImageType(): number { return fieldTypes.ATTR_TYPE_IMAGE }
  getAudioType(): number { return fieldTypes.ATTR_TYPE_AUDIO }
  getLocationType(): number { return fieldTypes.ATTR_TYPE_LOCATION }

  isAudioField(attr: IFieldDbEntity): boolean {
    return attr.type === fieldTypes.ATTR_TYPE_AUDIO
  }

  getItemValue(item: IItemDbEntity, attr: IFieldDbEntity, tryFormatted: boolean): any {
    const tableEntry = item.dataTable.find(
      entry => entry.fieldLocalId === attr.localId
    );
    if (tableEntry && tableEntry.sVal != null) {
      const helper = FieldManager.getHelper(attr.type);
      const deserializedValue = TypedStringSerializer.deserialize(
        tableEntry.sVal
      );
      if (helper && tryFormatted === true) {
        const formatted = helper.formatFieldValue(attr, deserializedValue);
        return formatted;
      } else { return deserializedValue; }
    } else { return null; }
  }

  getTimestampValue(item: IItemDbEntity): string {
    const stamp: TimePoint = new TimePoint(item.timestamp, item.timezone)
    return stamp.toMoment().format("kk:mm (MMM DD YYYY)") + " " + moment.tz(stamp.timezone).format("z")
  }

  getTrackerColumns(tracker: ITrackerDbEntity): any[] {
    const temp = tracker.fields.map((field) => field.localId)
    return temp.concat('timestamp')
  }

  getItemSourceText(source: string) {
    switch (source) {
      case "Trigger": return "by trigger"
      case "Manual": return "manually"
      default: return "unknown"
    }
  }

  onCellValueClicked(tracker: ITrackerDbEntity, field: IFieldDbEntity, item: IItemDbEntity) {
    this._internalSubscriptions.add(
      this.dialog.open(UpdateItemCellValueDialogComponent, { data: { info: { tracker: tracker, field: field, item: item } } }).afterClosed().subscribe(
        result => {
          if (result && result.value) {
            this._internalSubscriptions.add(
              this.api.selectedExperimentService.pipe(flatMap(expService => expService.trackingDataService.setItemColumnValue(field, item, result.value))).subscribe(
                updateResult => {
                }
              )
            )
          }
        }
      )
    )
  }

  onTimestampClicked(tracker: ITrackerDbEntity, item: IItemDbEntity) {
    const field: IFieldDbEntity = { name: "Logged At", type: 1 };
    this._internalSubscriptions.add(
      this.dialog.open(UpdateItemCellValueDialogComponent, { data: { info: { tracker: tracker, field: field, item: item } } }).afterClosed().subscribe(
        result => {
          if (result && result.value) {
            this._internalSubscriptions.add(
              this.api.selectedExperimentService.pipe(flatMap(expService => expService.trackingDataService.setItemTimestamp(item, TypedStringSerializer.deserialize(result.value).toDate().getTime(), TypedStringSerializer.deserialize(result.value).timezone))).subscribe(
                updateResult => {
                }
              )
            )
          }
        }
      )
    )

  }

  onExportClicked() {
    this.notificationService.pushSnackBarMessage({ message: "Start packing captured items.." })

    this._internalSubscriptions.add(
      this.api.selectedExperimentService.pipe(flatMap(service => service.downloadExperimentData())).subscribe(data => {
        FileSaver.saveAs(data, this.api.getSelectedExperimentId() + "_experiment-tracking-data.zip")
      })
    )

    return
    this._internalSubscriptions.add(
      this.api.selectedExperimentService.pipe(
        flatMap(service => service.getTrackingPlans().pipe(
          flatMap(plans =>
            zip(
              service.trackingDataService.trackers,
              service.trackingDataService.items,
              service.getExperiment(),
              (trackers, items, experiment) => ({ experiment, plans, trackers, items })
            )
          )
        )),
        map(result => {
          const commonColumns = ["item_id", "participant_alias", "group"]
          const planFiles = result.plans.map(
            pack => {
              //make table per plan
              const workbook = XLSX.utils.book_new()
              pack.data.trackers.forEach(
                trackerScheme => {
                  const injectedAttrNames = trackerScheme.fields.map(attr => attr.name)
                  const itemRows: Array<Array<any>> = [
                    commonColumns.concat(injectedAttrNames).concat(["logged at", "captured"]).concat(this.metadataColumns.map(c => this.styleMetadataKeyString(c)))
                  ]
                  const trackers = result.trackers.filter(t => (t.flags || {}).injectionId === trackerScheme.flags.injectionId && this.participants.find(p => p._id === t.user))
                  trackers.forEach(
                    tracker => {
                      const participant = this.participants.find(p => p._id === tracker.user)
                      const group = result.experiment.groups.find(g => g._id === participant.participationInfo.groupId)
                      result.items.filter(i => i.tracker === tracker._id).forEach(
                        item => {
                          const values = trackerScheme.fields.map(attrScheme => {
                            const attr = tracker.fields.find(a => (a.flags || {}).injectionId === attrScheme.flags.injectionId)
                            return attr != null ? this.getItemValue(item, attr, true) : null
                          })

                          itemRows.push(
                            [item._id, participant.participationInfo.alias, group != null ? group._id : null]
                              .concat(values)
                              .concat([new TimePoint(item.timestamp, item.timezone).toMoment().format(), this.getItemSourceText(item.source)]
                                .concat(this.metadataColumns.map(m => this.getMetadataValue(item, m)))
                              )
                          )
                        }
                      )
                    }
                  )

                  const sheet = XLSX.utils.aoa_to_sheet(itemRows)
                  XLSX.utils.book_append_sheet(workbook, sheet, trackerScheme.name)
                }
              )
              // save worksheet
              const workbookOut = XLSX.write(workbook, {
                bookType: 'xlsx', bookSST: false, type: 'array'
              })
              return {
                blob: new Blob([workbookOut], { type: "application/octet-stream" }),
                name: this.api.getSelectedExperimentId() + "_experiment-tracking-data_" + pack.name + ".xlsx"
              }
            })

          //extract custom trackers of each participant
          const participantCustomTrackerFiles = []
          this.participants.forEach(
            participant => {
              const trackers = result.trackers.filter(t => (t.flags || {}).experiment === this.api.getSelectedExperimentId() && participant._id === t.user)
              if (trackers.length > 0) {
                const workbook = XLSX.utils.book_new()

                trackers.forEach(tracker => {
                  const itemRows: Array<Array<any>> = [
                    commonColumns.concat(tracker.fields.map(attr => attr.name)).concat(["logged at", "captured"]).concat(this.metadataColumns.map(c => this.styleMetadataKeyString(c)))
                  ]
                  result.items.filter(i => i.tracker === tracker._id).forEach(
                    item => {
                      const values = tracker.fields.map(attr => {
                        return this.getItemValue(item, attr, true)
                      })
                      itemRows.push(
                        [item._id, participant.participationInfo.alias]
                          .concat(values)
                          .concat([new TimePoint(item.timestamp, item.timezone).toMoment().format(), this.getItemSourceText(item.source)])
                          .concat(this.metadataColumns.map(m => this.getMetadataValue(item, m)))
                      )
                    }
                  )
                  const sheet = XLSX.utils.aoa_to_sheet(itemRows)
                  XLSX.utils.book_append_sheet(workbook, sheet, tracker.name)
                })
                // save worksheet
                const workbookOut = XLSX.write(workbook, {
                  bookType: 'xlsx', bookSST: false, type: 'array'
                })

                participantCustomTrackerFiles.push(
                  {
                    blob: new Blob([workbookOut], { type: "application/octet-stream" }),
                    name: this.api.getSelectedExperimentId() + "_experiment-tracking-data-custom_" + participant.participationInfo.alias + ".xlsx"
                  }
                )
              }
            }
          )

          return planFiles.concat(participantCustomTrackerFiles)
        })
      ).subscribe(
        blobInfos => {
          if (blobInfos.length === 0) {
            this.notificationService.pushSnackBarMessage({ message: "No tracking items." })
          }
          else if (blobInfos.length === 1) {
            FileSaver.saveAs(blobInfos[0].blob, blobInfos[0].name)
          }
          else {
            const jsZip = new JSZip()
            blobInfos.forEach(b => {
              jsZip.file(b.name, b.blob)
            })
            jsZip.generateAsync({ type: 'blob' })
              .then(zipFile => {
                FileSaver.saveAs(zipFile, this.api.getSelectedExperimentId() + "_experiment-tracking-data.zip")
              })
          }
        }
      ))
  }
}
