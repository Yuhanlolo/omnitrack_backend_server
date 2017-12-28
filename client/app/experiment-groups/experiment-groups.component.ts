import { Component, OnInit } from '@angular/core';
import { ResearchApiService } from '../services/research-api.service';
import { ExperimentService } from '../services/experiment.service';

@Component({
  selector: 'app-experiment-groups',
  templateUrl: './experiment-groups.component.html',
  styleUrls: ['./experiment-groups.component.scss']
})
export class ExperimentGroupsComponent implements OnInit {

  private experimentService: ExperimentService
  constructor(private api: ResearchApiService) {
    this.experimentService = api.selectedExperimentService()
  }

  ngOnInit() {
  }
  
  onAddNewGroupClicked(){

  }
}
