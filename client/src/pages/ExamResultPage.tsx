import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { assessmentApi } from "@/services/api";
import { PageHeader, Button, LoadingSpinner, Badge } from "@/components/shared";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface ResultAnswer {
  id: string;
  questionId: string;
  selectedOptionId: string | null;
  textAnswer: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
  feedback: string | null;
  question: {
    id: string;
    stem: string;
    type: string;
    points: number;
    explanation: string | null;
  };
  options: { id: string; text: string; order: number; isCorrect: boolean }[];
}

interface ResultData {
  id: string;
  assessmentId: string;
  status: string;
  score: number | null;
  timeSpentSeconds: number;
  submittedAt: string;
  assessment: { title: string; passingScore: number };
  answers: ResultAnswer[];
  totalPossible: number;
}

export default function ExamResultPage() {
  const { attemptId } = useParams<{ assessmentId: string; attemptId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["attemptResult", attemptId],
    queryFn: () => assessmentApi.getAttemptResult(attemptId!),
    enabled: !!attemptId,
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Exam Result" subtitle="Loading..." />
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data?.data?.data) {
    return (
      <div>
        <PageHeader title="Exam Result" subtitle="Failed to load result" />
        <div className="text-center py-12 text-gray-500">Result not found or you don't have access.</div>
        <div className="flex justify-center mt-4">
          <Button onClick={() => navigate("/assessments")}>Back to Assessments</Button>
        </div>
      </div>
    );
  }

  const result: ResultData = data.data.data;
  const percentage = result.totalPossible > 0 ? Math.round(((result.score ?? 0) / result.totalPossible) * 100) : 0;
  const passed = percentage >= (result.assessment?.passingScore ?? 75);
  const timeMinutes = Math.floor((result.timeSpentSeconds ?? 0) / 60);
  const timeSeconds = (result.timeSpentSeconds ?? 0) % 60;

  return (
    <div>
      <PageHeader
        title={result.assessment?.title ?? "Exam Result"}
        subtitle="Your results"
        actions={
          <Button variant="secondary" onClick={() => navigate("/assessments")}>
            Back to Assessments
          </Button>
        }
      />

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-gray-900">{percentage}%</p>
            <p className="text-gray-500 mt-1">
              {result.score ?? 0} / {result.totalPossible} points
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Badge variant={passed ? "success" : "danger"}>
              {passed ? "Passed" : "Failed"}
            </Badge>
            <div className="flex items-center gap-1 text-sm text-gray-500 justify-center">
              <Clock size={14} />
              <span>Time: {timeMinutes}m {timeSeconds}s</span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Question Review</h2>
      <div className="space-y-4">
        {result.answers.map((answer, index) => {
          const isMcOrTf = answer.question.type === "MC" || answer.question.type === "TF";

          return (
            <div key={answer.id} className="bg-white rounded-lg border p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {answer.isCorrect === true ? (
                    <CheckCircle className="text-green-500" size={20} />
                  ) : answer.isCorrect === false ? (
                    <XCircle className="text-red-500" size={20} />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-yellow-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-500">Question {index + 1}</span>
                    <Badge variant="info">{answer.question.type}</Badge>
                    <span className="text-xs text-gray-400">
                      {answer.pointsAwarded}/{answer.question.points} pts
                    </span>
                  </div>
                  <p className="text-gray-900 font-medium mb-3">{answer.question.stem}</p>

                  {isMcOrTf && answer.options.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {answer.options.map((opt) => {
                        const isSelected = opt.id === answer.selectedOptionId;
                        const isCorrectOpt = opt.isCorrect;
                        let optStyle = "border-gray-200 text-gray-700";
                        if (isCorrectOpt) optStyle = "border-green-300 bg-green-50 text-green-800";
                        if (isSelected && !isCorrectOpt) optStyle = "border-red-300 bg-red-50 text-red-800";
                        if (isSelected && isCorrectOpt) optStyle = "border-green-500 bg-green-100 text-green-800";

                        return (
                          <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded border text-sm ${optStyle}`}>
                            {isCorrectOpt && <CheckCircle size={14} className="text-green-500 shrink-0" />}
                            {isSelected && !isCorrectOpt && <XCircle size={14} className="text-red-500 shrink-0" />}
                            <span>{opt.text}</span>
                            {isSelected && <span className="text-xs ml-auto font-medium">(Your answer)</span>}
                            {isCorrectOpt && !isSelected && <span className="text-xs ml-auto font-medium text-green-600">(Correct)</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!isMcOrTf && answer.textAnswer && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">Your answer:</p>
                      <p className="text-gray-700 bg-gray-50 rounded p-2 text-sm">{answer.textAnswer}</p>
                    </div>
                  )}

                  {!isMcOrTf && !answer.textAnswer && (
                    <p className="text-sm text-yellow-600 italic mb-3">No answer submitted</p>
                  )}

                  {answer.question.explanation && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
                      <span className="font-medium">Explanation:</span> {answer.question.explanation}
                    </div>
                  )}

                  {answer.feedback && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800 mt-2">
                      <span className="font-medium">Instructor feedback:</span> {answer.feedback}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center mt-6 mb-8">
        <Button onClick={() => navigate("/assessments")}>Back to Assessments</Button>
      </div>
    </div>
  );
}
