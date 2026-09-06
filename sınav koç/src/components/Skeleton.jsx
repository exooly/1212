import React from "react";

export function Skeleton({ className = "", height = 20, width = "100%" }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
      <Skeleton height={16} width="40%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? "70%" : "100%"} />
      ))}
      <Skeleton height={60} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <Skeleton height={120} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SkeletonCard key="main" lines={3} />
        <SkeletonCard key="side" lines={4} />
      </div>
    </div>
  );
}