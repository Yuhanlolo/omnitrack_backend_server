import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatTabsModule, MatCheckboxModule, MatRadioModule, MatMenuModule, MatIconRegistry, MatButtonModule, MatSelectModule, MatInputModule, MatTooltipModule, MatDatepickerModule, MatNativeDateModule, MatSnackBarModule, MatProgressBarModule, MatProgressSpinnerModule, MatAutocompleteModule, MatChipsModule, MatGridListModule, MatCardModule } from '@angular/material';
import { YesNoDialogComponent } from './dialogs/yes-no-dialog/yes-no-dialog.component';

@NgModule({
  imports: [
    CommonModule,
    MatDialogModule,
    MatTabsModule,
    MatCheckboxModule,
    MatRadioModule,
    MatMenuModule,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatGridListModule,
    MatCardModule
  ],
  exports: [
    MatDialogModule,
    MatTabsModule,
    MatCheckboxModule,
    MatRadioModule,
    MatMenuModule,
    MatButtonModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatGridListModule,
    MatCardModule
  ],
   providers: [
    MatIconRegistry]
})
export class MaterialDesignModule { }
