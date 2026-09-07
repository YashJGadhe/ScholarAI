import { AlertCircle } from 'lucide-react';

export default function DemoDisclaimer() {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="ml-3">
          <h3 className="text-sm font-semibold text-amber-800">
            Demo Mode - No Real Research Papers
          </h3>
          <p className="text-sm text-amber-700 mt-1">
            This system is currently running in demo mode. Citation metrics are real (from your institutional data), 
            but research papers will only appear after connecting to academic APIs (Scopus, Google Scholar, ORCID, Web of Science).
          </p>
          <p className="text-sm text-amber-700 mt-2">
            <strong>To fetch real papers:</strong> Configure API keys in System &gt; API Settings
          </p>
        </div>
      </div>
    </div>
  );
}
