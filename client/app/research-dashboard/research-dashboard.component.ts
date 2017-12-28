import { Component, OnInit } from '@angular/core';
import { ResearcherAuthService } from '../services/researcher.auth.service';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { ResearchApiService } from '../services/research-api.service';
import ExperimentInfo from '../models/experiment-info';

@Component({
  selector: 'app-research-dashboard',
  templateUrl: './research-dashboard.component.html',
  styleUrls: ['./research-dashboard.component.scss']
})
export class ResearchDashboardComponent implements OnInit {

  isLoadingSelectedExperiment: boolean = true
  isLoadingExperiments: boolean = true

  headerTitle

  experimentInfos: Array<ExperimentInfo> = []

  dashboardNavigationGroups = [
    {
      name: "Analytics",
      menus: [
        { name: "Overview", key: "overview" },
        {
          name: "Self-Tracking Data",
          key: "tracking-data"
        },
        {
          name: "Participants",
          key: "participants"
        }
      ]
    },
    {
      name: "Design",
      menus: [
        {
          name: "Groups",
          key: "groups"
        },
        {
          name: "OmniTrack",
          key: "omnitrack"
        }
      ]
    },
    {
      name: "Settings",
      menus: [
        {
          name: "Invitations",
          key: "invitations"
        },
        {
          name: "Experiment Settings",
          key: "settings"
        }
      ]
    }

  ]

  constructor(
    private api: ResearchApiService,
    private authService: ResearcherAuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute) {
    this.router.events.filter(ev => ev instanceof NavigationEnd)
      .map(_ => this.router.routerState.root)
      .map(route => {
        while (route.firstChild) route = route.firstChild
        return route
      })
      .flatMap(route => route.data)
      .subscribe(data => {
        this.headerTitle = data["title"]
      })
  }

  ngOnInit() {
    //init experiment infos
    this.activatedRoute.paramMap.subscribe(paramMap => {
      const paramExpId = paramMap.get("experimentId")
      if (paramExpId) {
        console.log("mount an experiment : " + paramExpId)
        localStorage.setItem("selectedExperiment", paramExpId)
        this.api.setSelectedExperimentId(paramExpId).subscribe((exp) => {
          this.isLoadingSelectedExperiment = false
        })
      }
      else {
        this.api.getExperimentInfos().subscribe(experiments => {
          this.isLoadingExperiments = false
          this.experimentInfos = experiments
          if (this.experimentInfos.length > 0) {
            var selectedId = localStorage.getItem("selectedExperiment") || this.experimentInfos[0].id
            if (this.experimentInfos.findIndex(exp => exp.id == selectedId) == -1) {
              selectedId = this.experimentInfos[0].id
            }
            this.router.navigate(['research/dashboard', selectedId])
          }
        })
      }
    })

    console.log("load experiments of user")
    this.api.getExperimentInfos().subscribe(experiments => {
      console.log("experiments were loaded.")
      this.isLoadingExperiments = false
      this.experimentInfos = experiments
    })
  }

  getSelectedMenuTitle() {
  }

  onExperimentSelected(id) {
    this.isLoadingSelectedExperiment = true
    this.api.setSelectedExperimentId(id).subscribe((exp) => {
      this.isLoadingSelectedExperiment = false
    })
  }

  signOut() {
    this.authService.signOut().subscribe((signedOut) => {
      console.log("successfully signed out.")
      this.goToSignIn()
    })
  }

  goToSignIn() {
    this.router.navigate(['/research/login'])
  }

}
