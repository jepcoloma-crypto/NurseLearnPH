import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { clinicalApi } from "@/services/api";
import { PageHeader, Button, Badge, Card, LoadingSpinner } from "@/components/shared";
import { toast } from "react-hot-toast";
import { ChevronLeft, ChevronRight, Send } from "lucide-react";

interface StageOption {
  id: string;
  text: string;
  order: number;
}

interface Stage {
  id: string;
  stageNumber: number;
  title: string;
  description: string;
  scenario: string;
  points: number;
  options: StageOption[];
  correctOptionId: string | null;
  feedback: string | null;
}

interface AttemptCase {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  department: string;
  stages: Stage[];
}

interface Attempt {
  id: string;
  caseId: string;
  status: string;
  totalPoints: number;
  score: number | null;
  startedAt: string;
  case: AttemptCase;
  responses: Array<{ stageId: string; selectedOptionId: string }>;
}

export default function CaseAttemptPage() {
  const { caseId, attemptId } = useParams<{ caseId: string; attemptId: string }>();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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

  const submitMutation = useMutation({
    mutationFn: () => {
      const responses = Object.entries(answers).map(([stageId, selectedOptionId]) => ({
        stageId,
        selectedOptionId,
      }));
      return clinicalApi.submitAttempt(attemptId!, { responses });
    },
    onSuccess: () => {
      toast.success("Case submitted successfully!");
      navigate(`/cases/${caseId}/attempt/${attemptId}/result`);
    },
    onError: () => {
      toast.error("Failed to submit case");
    },
  });

  if (attemptLoading || caseLoading) {
    return (
      <div>
        <PageHeader title="Clinical Case" subtitle="Loading..." />
        <LoadingSpinner />
      </div>
    );
  }

  const attempt: Attempt | null = attemptData?.data?.data ?? null;
  const caseFromApi: AttemptCase | null = caseData?.data?.data ?? attempt?.case ?? null;

  if (!attempt || !caseFromApi) {
    return (
      <div>
        <PageHeader title="Clinical Case" subtitle="Failed to load attempt" />
      </div>
    );
  }

  const stages = caseFromApi.stages ?? [];
  const currentStage = stages[currentIndex];
  const answeredCount = Object.keys(answers).length;

  const handleSubmit = () => {
    if (answeredCount < stages.length) {
      if (!window.confirm(`You have only answered ${answeredCount} of ${stages.length} stages. Submit anyway?`)) {
        return;
      }
    } else {
      if (!window.confirm("Are you sure you want to submit?")) return;
    }
    submitMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title={caseFromApi.title}
        subtitle={[caseFromApi.difficulty, caseFromApi.department].filter(Boolean).join(" · ")}
        actions={
          <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
            <Send size={16} />
            {submitMutation.isPending ? "Submitting..." : "Submit Case"}
          </Button>
        }
      />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-500">Progress</span>
          <span className="text-sm text-gray-500">{currentIndex + 1} of {stages.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentIndex + 1) / stages.length) * 100}%` }}
          />
        </div>
      </div>

      {currentStage && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="info">Stage {currentStage.stageNumber}</Badge>
            <span className="text-sm text-gray-500">{currentStage.points} pts</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{currentStage.title}</h3>
          {currentStage.description && (
            <p className="text-gray-600 mb-4">{currentStage.description}</p>
          )}
          {currentStage.scenario && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Patient Scenario</p>
              <p className="text-gray-600">{currentStage.scenario}</p>
            </div>
          )}

          <div className="space-y-2 mt-4">
            {currentStage.options.map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  answers[currentStage.id] === option.id
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name={`stage-${currentStage.id}`}
                  checked={answers[currentStage.id] === option.id}
                  onChange={() => setAnswers((prev) => ({ ...prev, [currentStage.id]: option.id }))}
                  className="text-primary-600"
                />
                <span className="text-gray-700">{option.text}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={16} />
          Previous
        </Button>
        <div className="flex items-center gap-1">
          {stages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-8 h-8 rounded text-xs font-medium ${
                i === currentIndex
                  ? "bg-primary-600 text-white"
                  : answers[stages[i].id]
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <Button
          onClick={() => setCurrentIndex((i) => Math.min(stages.length - 1, i + 1))}
          disabled={currentIndex >= stages.length - 1}
        >
          Next
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
