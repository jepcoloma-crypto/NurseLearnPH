ALTER TABLE "nle_question_bank" ADD CONSTRAINT "nle_question_bank_question_text_unique" UNIQUE("question_text");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_course_stem_unique" ON "questions" ("course_id","stem");--> statement-breakpoint
