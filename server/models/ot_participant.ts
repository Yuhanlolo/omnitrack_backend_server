import * as mongoose from 'mongoose';
import { MAX_VALUE } from 'long';

const otParticipantSchema = new mongoose.Schema({
  alias: String,
  user: {type: String, ref: "OTUser"},
  experiment: {type: String, ref: "OTExperiment"},
  groupId: String,
  excludedDays: {type: [Date], default: []},
  invitation: {type: mongoose.Schema.Types.ObjectId, ref: "OTInvitation"},
  approvedAt: Date,
  dropped: {type: Boolean, index: true, default: false},
  droppedReason: String,
  droppedBy: {type: String, ref: "OTResearcher", defaut: null},
  droppedAt: Date,
  information: mongoose.Schema.Types.Mixed,
  experimentRange: {from: Date, to: Date}
}, {timestamps: true});

otParticipantSchema.index({dropped: 1, isConsentApproved: 1})
const OTParticipant = mongoose.model('OTParticipant', otParticipantSchema);

export default OTParticipant;
