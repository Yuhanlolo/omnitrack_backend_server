import { Component, OnInit } from '@angular/core';
import { ResearchApiService } from '../services/research-api.service';
import { ExperimentService } from '../services/experiment.service';

@Component({
  selector: 'app-experiment-omnitrack',
  templateUrl: './experiment-omnitrack.component.html',
  styleUrls: ['./experiment-omnitrack.component.scss']
})
export class ExperimentOmniTrackComponent implements OnInit {

  private experimentService: ExperimentService
  constructor(private api: ResearchApiService) {
    this.experimentService = api.selectedExperimentService()
   }

  ngOnInit() {
  }

}
