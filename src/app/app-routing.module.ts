import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VideoConferenceComponent } from './video-conference/video-conference.component'

const routes: Routes = [{
  path: 'video' , component: VideoConferenceComponent, data: { title: "Meeting"}
}];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
