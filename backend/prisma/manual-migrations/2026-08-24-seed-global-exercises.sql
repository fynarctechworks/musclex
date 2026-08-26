-- Global exercise catalogue (app_user_id IS NULL = visible to everyone).
-- Idempotent: keyed on the name of a system exercise, so a re-run updates
-- nothing and inserts nothing twice.
BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS app_user_exercises_system_name_key
  ON public.app_user_exercises (name) WHERE app_user_id IS NULL;

INSERT INTO public.app_user_exercises (app_user_id, name, muscle_group, target_muscle, tracking_type)
VALUES
  (NULL,'Back Squat','legs','quads','reps'),
  (NULL,'Front Squat','legs','quads','reps'),
  (NULL,'Goblet Squat','legs','quads','reps'),
  (NULL,'Romanian Deadlift','legs','hamstrings','reps'),
  (NULL,'Deadlift','back','lower_back','reps'),
  (NULL,'Leg Press','legs','quads','reps'),
  (NULL,'Walking Lunge','legs','glutes','reps'),
  (NULL,'Bulgarian Split Squat','legs','glutes','reps'),
  (NULL,'Leg Curl','legs','hamstrings','reps'),
  (NULL,'Calf Raise','legs','calves','reps'),
  (NULL,'Bench Press','chest','mid_chest','reps'),
  (NULL,'Incline Dumbbell Press','chest','upper_chest','reps'),
  (NULL,'Push Up','chest','mid_chest','reps'),
  (NULL,'Chest Fly','chest','mid_chest','reps'),
  (NULL,'Dip','chest','lower_chest','reps'),
  (NULL,'Pull Up','back','lats','reps'),
  (NULL,'Chin Up','back','lats','reps'),
  (NULL,'Lat Pulldown','back','lats','reps'),
  (NULL,'Barbell Row','back','mid_back','reps'),
  (NULL,'Seated Cable Row','back','mid_back','reps'),
  (NULL,'Face Pull','shoulders','rear_delt','reps'),
  (NULL,'Overhead Press','shoulders','front_delt','reps'),
  (NULL,'Dumbbell Shoulder Press','shoulders','front_delt','reps'),
  (NULL,'Lateral Raise','shoulders','side_delt','reps'),
  (NULL,'Rear Delt Fly','shoulders','rear_delt','reps'),
  (NULL,'Barbell Curl','arms','biceps','reps'),
  (NULL,'Dumbbell Curl','arms','biceps','reps'),
  (NULL,'Hammer Curl','arms','biceps','reps'),
  (NULL,'Triceps Pushdown','arms','triceps','reps'),
  (NULL,'Skull Crusher','arms','triceps','reps'),
  (NULL,'Plank','core','abs','duration'),
  (NULL,'Side Plank','core','obliques','duration'),
  (NULL,'Hanging Leg Raise','core','abs','reps'),
  (NULL,'Cable Crunch','core','abs','reps'),
  (NULL,'Russian Twist','core','obliques','reps'),
  (NULL,'Dead Bug','core','abs','reps'),
  (NULL,'Farmer Carry','full_body','forearms','duration'),
  (NULL,'Kettlebell Swing','full_body','glutes','reps'),
  (NULL,'Burpee','full_body','full_body','reps'),
  (NULL,'Treadmill Run','cardio','cardio','duration'),
  (NULL,'Stationary Bike','cardio','cardio','duration'),
  (NULL,'Rowing Machine','cardio','cardio','duration'),
  (NULL,'Elliptical','cardio','cardio','duration'),
  (NULL,'Jump Rope','cardio','cardio','duration'),
  (NULL,'Stair Climber','cardio','cardio','duration')
ON CONFLICT DO NOTHING;

COMMIT;
