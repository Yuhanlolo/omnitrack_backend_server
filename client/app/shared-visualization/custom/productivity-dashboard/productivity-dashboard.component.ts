import { Component, OnInit, Input } from '@angular/core';
import { IItemDbEntity, ITrackerDbEntity } from '../../../../../omnitrack/core/db-entity-types';
import TypedStringSerializer from '../../../../../omnitrack/core/typed_string_serializer';
import d3 = require('d3');
import { TimePoint } from '../../../../../omnitrack/core/datatypes/field_datatypes';
import { Moment } from 'moment';
import { ScaleLinear } from 'd3';
import PropertyHelperManager from '../../../../../omnitrack/core/properties/property.helper.manager';
import { EPropertyType } from '../../../../../omnitrack/core/properties/property.types';
import ChoiceAttributeHelper from '../../../../../omnitrack/core/attributes/choice.attribute.helper';

@Component({
  selector: 'app-productivity-dashboard',
  templateUrl: './productivity-dashboard.component.html',
  styleUrls: ['./productivity-dashboard.component.scss']
})
export class ProductivityDashboardComponent implements OnInit {
  private readonly INJECTION_ID_PIVOT_TYPE = "OZLc8BKS";
  private readonly INJECTION_ID_PIVOT_TIME = "UDTGuxJm";
  private readonly INJECTION_ID_DURATION = "uyMhOEin";
  private readonly INJECTION_ID_PRODUCTIVITY = "QizUYovc";
  private readonly INJECTION_ID_TASKS = "3CVBwMM1";
  private readonly INJECTION_ID_USED_DEVICES = "KJeafavG";
  private readonly INJECTION_ID_LOCATION = "ztoRgnIY";
  

  private trackingSet: TrackingSet;
  decodedItems: Array<DecodedItem> = [];
  logs: Array<ProductivityLog> = [];

  productivityColorScale: ScaleLinear<d3.RGBColor, string>

  @Input("trackingSet")
  set _trackingSet(trackingSet: TrackingSet) {
    this.trackingSet = trackingSet;

    if (trackingSet) {

      const taskEntries = this.getChoiceEntryListByAttrInjectionId(trackingSet.tracker, this.INJECTION_ID_TASKS)
      const locationEntries = this.getChoiceEntryListByAttrInjectionId(trackingSet.tracker, this.INJECTION_ID_LOCATION)
      const deviceEntries = this.getChoiceEntryListByAttrInjectionId(trackingSet.tracker, this.INJECTION_ID_USED_DEVICES)

      console.log(taskEntries)
      console.log(locationEntries)
      console.log(deviceEntries)

      const decodedItems: Array<DecodedItem> = []
      const logs: Array<ProductivityLog> = []
      trackingSet.items.forEach(item => {
        const _pivotType : Array<number> = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_PIVOT_TYPE);
        const pivotType : number = (_pivotType && _pivotType.length > 0)? _pivotType[0] : null

        const pivotTime : TimePoint = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_PIVOT_TIME);
        
        const _duration = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_DURATION);

        const duration: number = _duration? Number(_duration.toString()) : null

        const _productivity : Array<number> = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_PRODUCTIVITY);

        const productivity = (_productivity && _productivity.length > 0) ? _productivity[0] : null

        if(pivotType!=null && pivotTime!=null && duration!=null && productivity!=null){
          
          const _taskIds = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_TASKS);
          const _locationIds = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_LOCATION)
          const _deviceIds = this.getAttributeValueByInjectionId(trackingSet.tracker, item, this.INJECTION_ID_USED_DEVICES)

          const pivotMoment = pivotTime.toMoment()
          var startMoment: Moment
          var endMoment: Moment

          if(pivotType === 0){
            //pivot is start
            startMoment = pivotMoment.clone()
            endMoment = pivotMoment.clone()
            endMoment.add(duration, "minutes")
          } else {
            //pivot is end
            endMoment = pivotMoment.clone()
            startMoment = pivotMoment.clone()
            startMoment.subtract(duration, "minutes")
          }

          //divide into logs if exceeds.

          const startDayStart = startMoment.clone().startOf('day')
          const startRatio = startMoment.diff(startDayStart, 'day', true)
          const endDiffRatio = endMoment.diff(startDayStart, 'day', true)
          const numDaysBetween = Math.floor(endDiffRatio)

          //Make daily entry logs
          const dominantDate = (startRatio + endDiffRatio)*.5 <= 1? startDayStart.toDate() : endMoment.clone().startOf('day').toDate()
          
          decodedItems.push(
            {
              productivity: productivity, 
              duration: duration, 
              dominantDate: dominantDate,
              dominantDateNumber: dominantDate.getTime(),
              usedDevices: _deviceIds? _deviceIds.map(id => deviceEntries.entries.find(d => d.id=== id).val) : [],
              location: (_locationIds && _locationIds.length > 0)? locationEntries.entries.find(l => l.id === _locationIds[0]).val : null,
              tasks: _taskIds ? _taskIds.map(id => taskEntries.entries.find(d => d.id === id).val) : [],
              item: item
            })
          
          //Make timeline logs
          logs.push(
            {
              dateStart: startDayStart.toDate().getTime(),
              fromDateRatio: startRatio,
              toDateRatio: Math.min(endDiffRatio, 1),
              productivity: productivity,
              item: item
            }
          )

          for(var i = 0; i<numDaysBetween; i++)
          {
            logs.push(
              {
                dateStart: startDayStart.clone().add(1 + i, 'day').toDate().getTime(),
                fromDateRatio: 0,
                toDateRatio: Math.min(endDiffRatio - (1+i), 1),
                productivity: productivity,
                item: item
              }
            )
          }
        }
        else{
        }
      });

      this.logs = logs
      this.decodedItems = decodedItems
    }
  }

  getChoiceEntryListByAttrInjectionId(tracker: ITrackerDbEntity, injectionId: string): any{
    return PropertyHelperManager.getHelper(EPropertyType.ChoiceEntryList).deserializePropertyValue(tracker.attributes.find(attr => attr.flags.injectionId === injectionId).properties.find(prop=>prop.key == ChoiceAttributeHelper.PROPERTY_ENTRIES).sVal)
  }

  getAttributeValueByInjectionId(
    tracker: ITrackerDbEntity,
    item: IItemDbEntity,
    injectionId: string
  ): any {
    const attr = tracker.attributes.find(
      attr => attr.flags.injectionId === injectionId
    );
    if (attr) {
      const entry = item.dataTable.find(
        entry => entry.attrLocalId === attr.localId
      );
      if (entry) {
        return TypedStringSerializer.deserialize(entry.sVal);
      } else return null;
    } else return null;
  }

  constructor() {

    this.productivityColorScale = d3.scaleLinear<d3.RGBColor, number>().domain([0, 2]).interpolate(d3.interpolateHcl).range([d3.rgb("rgb(243, 220, 117)"), d3.rgb("#2387a0")])
  }

  ngOnInit() {}
}

export type TrackingSet = {
  tracker: ITrackerDbEntity;
  items: Array<IItemDbEntity>;
};

/* This log is not 1:1 matched with the items. 
 * The items can be divided into multiple logs if the range exceeds the day.
*/

export type DecodedItem = {
  productivity: number,
  duration: number,
  usedDevices: ArrayLike<string>,
  tasks: ArrayLike<string>,
  location: string,
  dominantDate: Date,
  dominantDateNumber: number,
  item: IItemDbEntity
}

export class ProductivityLog {
  dateStart: number;
  fromDateRatio: number;
  toDateRatio: number;
  productivity: number;
  item: IItemDbEntity;
}

export interface ProductivityTimelineData {
  logs: Array<ProductivityLog>

}