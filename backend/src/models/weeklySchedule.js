import mongoose from "mongoose";

const WeeklyScheduleSchema = new mongoose.Schema({
    day_of_week: {
      type: Number, // 0 = Minggu, 6 = Sabtu
      required: true,
      unique: true,
    },
  
    check_in: {
      type: String, // "08:00"
      default: null,
    },
  
    check_out: {
      type: String, // "17:00"
      default: null,
    },
  
    is_working_day: {
      type: Boolean,
      default: true,
    },
  });

  export default mongoose.model("WeeklySchedule", WeeklyScheduleSchema);