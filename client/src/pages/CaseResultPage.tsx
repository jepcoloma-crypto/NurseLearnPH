import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { clinicalApi } from "@/services/api";
import { PageHeader, Button, Badge, Card, LoadingSpinner } from "@/components/shared";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";

export default function CaseResultPage() {
  const { caseId, attemptId } = useParams<{ caseId: string; attemptId: string }>();
  const navigate = useNavigate();

  const { data: attemptData, isLoading: attemptLoading } = useQuery({
    queryKey: ["clinicalAttempt", attemptId],
    queryFn: () => clinicalApi.getAttempt(attemptId!),
    enabled: !!attemptId,
  });

  const { data: caseData, isLoading: caseLoading } = useQuery({
    queryKey: ["clinicalCase", caseId],
    queryFn: () => clinicalApi.getCase(caseId!),
    enabled: !!caseId,
  });

  const retakeMutation = useMutation({
    mutationFn: (cid: string) => clinicalApi.startCase(cid),
    onSuccess: (res) => {
      const attempt = res.data.data;
      toast.success("New attempt started!");
      navigate(`/cases/${attempt.caseId}/attempt/${attempt.id}`);
    },
    onError: () => toast.error("Failed to start case"),
  });

  if (attemptLoading || caseLoading) {
    return (
      <div>
        <PageHeader title="Case Result" subtitle="Loading..." />
        <LoadingSpinner />
      </div>
    );
  }

  const attempt = attemptData?.data?.data;
  const caseFromApi = caseData?.data?.data;

  if (!attempt || !caseFromApi) {
    return (
      <div>
        <PageHeader title="Case Result" subtitle="Failed to load result" />
        <Button onClick={() => navigate("/cases")}>Back to Cases</Button>
      </div>
    );
  }

  const stages = caseFromApi.stages ?? [];
  const responses = attempt.responses ?? [];
  const percentage = attempt.totalPoints > 0 ? Math.round((attempt.score / attempt.totalPoints) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={caseFromApi.title}
        subtitle="Case Result"
        actions={
          <Button variant="secondary" onClick={() => navigate("/cases")}>
            <ArrowLeft size={16} /> Back to Cases
          </Button>
        }
      />

      {/* Score Summary */}
      <Card className="mb-6">
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-900 mb-2">
            {attempt.score} / {attempt.totalPoints}
          </div>
          <p className="text-gray-500 mb-3">Total Points</p>
          <div className="flex items-center justify-center gap-4">
            <Badge variant={percentage >= 70 ? "success" : percentage >= 50 ? "warning" : "danger"}>
              {percentage}%
            </Badge>
            <span className="text-sm text-gray-500">
              {responses.filter((r: Record<string, unknown>) => r.isCorrect).length} of {stages.length} correct
            </span>
          </div>
          {attempt.timeSpentSeconds > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Time spent: {Math.floor(attempt.timeSpentSeconds / 60)}m {attempt.timeSpentSeconds % 60}s
            </p>
          )}
        </div>
      </Card>

      {/* Stage Breakdown */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h2>
      <div className="space-y-4">
        {stages.map((stage: Record<string, unknown>, i: number) => {
          const stageId = String(stage.id);
          const stageOptions = (stage.options ?? []) as Record<string, unknown>[];
          const response = responses.find((r: Record<string, unknown>) => String(r.stageId) === stageId);
          const selectedOptionId = response ? String(response.selectedOptionId) : null;
          const isCorrect = response ? Boolean(response.isCorrect) : false;
          const pointsAwarded = response ? Number(response.pointsAwarded) : 0;

          return (
            <Card key={stageId}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${isCorrect ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {isCorrect ? <CheckCircle size={20} /> : <XCircle size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">Stage {i + 1}: {String(stage.title)}</h3>
                    <Badge variant={isCorrect ? "success" : "danger"}>
                      {pointsAwarded}/{String(stage.points)} pts
                    </Badge>
                  </div>
                  {stage.description ? (
                    <p className="text-sm text-gray-600 mb-3">{String(stage.description)}</p>
                  ) : null}

                  {/* Options */}
                  <div className="space-y-2">
                    {stageOptions.map((opt) => {
                      const optId = String(opt.id);
                      const isSelected = selectedOptionId === optId;
                      const isCorrectOpt = Boolean(opt.isCorrect);
                      let borderColor = "border-gray-200";
                      let bgColor = "bg-white";
                      if (isCorrectOpt) { borderColor = "border-green-300"; bgColor = "bg-green-50"; }
                      if (isSelected && !isCorrectOpt) { borderColor = "border-red-300"; bgColor = "bg-red-50"; }

                      return (
                        <div key={optId} className={`p-3 rounded-lg border ${borderColor} ${bgColor}`}>
                          <div className="flex items-center gap-2">
                            {isCorrectOpt && <CheckCircle size={16} className="text-green-600 flex-shrink-0" />}
                            {isSelected && !isCorrectOpt && <XCircle size={16} className="text-red-600 flex-shrink-0" />}
                            {!isCorrectOpt && !isSelected && <span className="w-4" />}
                            <span className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                              {String(opt.text)}
                            </span>
                            {isSelected && <span className="ml-auto"><Badge variant="info">Your answer</Badge></span>}
                            {isCorrectOpt && !isSelected && <span className="ml-auto"><Badge variant="success">Correct</Badge></span>}
                          </div>
                          {opt.rationale ? (
                            <p className="text-xs text-gray-600 mt-1 ml-6">{String(opt.rationale)}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-6">
        <Button variant="secondary" onClick={() => navigate("/cases")}>
          <ArrowLeft size={16} /> Back to Cases
        </Button>
        <Button onClick={() => retakeMutation.mutate(String(caseId))} disabled={retakeMutation.isPending}>
          Retake Case
        </Button>
      </div>
    </div>
  );
}
