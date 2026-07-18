"use client";

type RateConfigType = {
  target_rate: number;
  max_requests_per_sec: number;
  batch_size: number;
  max_retries: number;
};

export function RateConfigPanel({
  config,
  onChange,
}: {
  config: RateConfigType;
  onChange: (c: RateConfigType) => void;
}) {
  const set = (key: keyof RateConfigType, value: number) =>
    onChange({ ...config, [key]: value });

  const batchesPerMin = config.target_rate / config.batch_size;
  const reqPerSecNeeded = batchesPerMin / 60;
  const effectiveReqPerSec = Math.min(reqPerSecNeeded, config.max_requests_per_sec);
  const effectiveRate = Math.round(effectiveReqPerSec * 60 * config.batch_size);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <NumberField
          label="Target rate (emails/min)"
          hint="Your desired throughput. Usually the binding constraint."
          value={config.target_rate}
          min={1}
          max={10000}
          step={10}
          onChange={(v) => set("target_rate", v)}
        />
        <NumberField
          label="Max requests/sec"
          hint="Hard ceiling on API calls/sec. Resend default limit is 2. Keep headroom."
          value={config.max_requests_per_sec}
          min={0.1}
          max={2}
          step={0.1}
          onChange={(v) => set("max_requests_per_sec", v)}
        />
        <NumberField
          label="Batch size"
          hint="Emails per batch call. Resend allows up to 100."
          value={config.batch_size}
          min={1}
          max={100}
          step={1}
          onChange={(v) => set("batch_size", v)}
        />
        <NumberField
          label="Max retries"
          hint="Retry attempts per failed batch (exponential backoff with jitter)."
          value={config.max_retries}
          min={1}
          max={10}
          step={1}
          onChange={(v) => set("max_retries", v)}
        />
      </div>

      <div className="p-4 border border-foreground/10 rounded-lg bg-foreground/[0.02] text-sm space-y-1">
        <h3 className="font-medium mb-2">Projected pacing</h3>
        <Row label="Batches/min (at target)" value={batchesPerMin.toFixed(1)} />
        <Row label="Requests/sec needed" value={reqPerSecNeeded.toFixed(2)} />
        <Row
          label="Effective throughput"
          value={`~${effectiveRate.toLocaleString()} emails/min`}
        />
        {reqPerSecNeeded > config.max_requests_per_sec && (
          <p className="text-amber-600 dark:text-amber-400 pt-1">
            Target rate exceeds the request ceiling — sending will be capped at{" "}
            {config.max_requests_per_sec} req/s.
          </p>
        )}
      </div>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-lg border border-foreground/20 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-foreground/30"
      />
      <p className="text-xs text-foreground/50 mt-1">{hint}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-foreground/60">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
