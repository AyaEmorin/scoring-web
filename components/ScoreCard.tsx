interface Props {
  question: string;
  expectedTopics: string | null;
  groundTruth: string | null;
  botAnswer: string;
}

export default function ScoreCard({ question, expectedTopics, groundTruth, botAnswer }: Props) {
  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">คำถาม</span>
          <p className="mt-0.5 text-gray-700">{question}</p>
        </div>
        {expectedTopics && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Expected Topics</span>
            <p className="mt-0.5 text-gray-600">{expectedTopics}</p>
          </div>
        )}
        {groundTruth && (
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ground Truth</span>
            <p className="mt-0.5 text-gray-600">{groundTruth}</p>
          </div>
        )}
      </div>

      <div className="bg-white border-2 border-blue-200 rounded-lg p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-blue-500">คำตอบของ Bot (ให้คะแนนส่วนนี้)</span>
        <p className="mt-2 text-gray-900 leading-relaxed">{botAnswer}</p>
      </div>
    </div>
  );
}
