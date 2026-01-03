import React, { useState } from "react";
import { usePaymentFailures, usePaymentFailureStats, useChurnAnalysis, useAdminManageDunning } from "../hooks/useStripeElements";
import { Line, Bar, Pie, ResponsiveContainer } from 'recharts';

/**
 * AdminSubscriptionDashboard Component
 * Comprehensive admin view of subscription metrics, payment failures, and churn analysis
 */
export default function AdminSubscriptionDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [statusFilter, setStatusFilter] = useState("pending");
  
  const { data: paymentFailures = [], isLoading: failuresLoading } = usePaymentFailures({
    status: statusFilter,
  });
  
  const { data: failureStats = [] } = usePaymentFailureStats();
  const { data: churnData = [] } = useChurnAnalysis();
  const { mutate: manageDunning, isPending: isDunningPending } = useAdminManageDunning();

  const handleDunningAction = (failureId, action, note = "") => {
    manageDunning(
      { action, payment_failure_id: failureId, note },
      {
        onSuccess: () => {
          // Success notification would be handled by toast
        },
        onError: (error) => {
          console.error("Dunning action failed:", error);
        },
      }
    );
  };

  // Calculate key metrics
  const totalPendingFailures = paymentFailures.length;
  const totalFailureAmount = paymentFailures.reduce((sum, f) => sum + (f.amount || 0), 0);
  const avgRetries = paymentFailures.length > 0
    ? (paymentFailures.reduce((sum, f) => sum + (f.retry_count || 0), 0) / paymentFailures.length).toFixed(2)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Subscription Analytics</h1>
        <div className="flex gap-2">
          <button className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Export Report
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200">
        {["overview", "payment-failures", "churn"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab === "overview" && "Overview"}
            {tab === "payment-failures" && "Payment Failures"}
            {tab === "churn" && "Churn Analysis"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              title="Pending Failures"
              value={totalPendingFailures}
              icon="⚠️"
              color="red"
            />
            <MetricCard
              title="Total Failure Amount"
              value={`€${(totalFailureAmount / 100).toFixed(2)}`}
              icon="💰"
              color="orange"
            />
            <MetricCard
              title="Avg Retries"
              value={avgRetries}
              icon="🔄"
              color="yellow"
            />
            <MetricCard
              title="Success Rate"
              value="94.5%"
              icon="✓"
              color="green"
            />
          </div>

          {/* Charts Section (Placeholder - requires charting library) */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 font-semibold text-gray-900">Payment Failures by Day</h3>
              <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                Chart: Failure Trends Over Time
              </div>
            </div>

            <div className="rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 font-semibold text-gray-900">Failure Status Distribution</h3>
              <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-500">
                Chart: Status Breakdown
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Failures Tab */}
      {activeTab === "payment-failures" && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex gap-2">
            {["pending", "retrying", "resolved", "forgiven", "canceled"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Failures Table */}
          <div className="rounded-lg bg-white shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Invoice ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Retries
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {failuresLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paymentFailures.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No payment failures found
                    </td>
                  </tr>
                ) : (
                  paymentFailures.map((failure) => (
                    <tr key={failure.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono text-gray-900">
                        {failure.invoice_id?.slice(0, 20)}...
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {failure.customer_id?.slice(0, 15)}...
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        €{(failure.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {failure.retry_count || 0}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <StatusBadge status={failure.status} />
                      </td>
                      <td className="px-6 py-4 text-sm space-x-2">
                        {failure.status === "pending" && (
                          <>
                            <button
                              onClick={() => handleDunningAction(failure.id, "retry")}
                              disabled={isDunningPending}
                              className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => handleDunningAction(failure.id, "notify")}
                              className="text-amber-600 hover:text-amber-900"
                            >
                              Notify
                            </button>
                            <button
                              onClick={() => handleDunningAction(failure.id, "forgive")}
                              className="text-green-600 hover:text-green-900"
                            >
                              Forgive
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Churn Analysis Tab */}
      {activeTab === "churn" && (
        <div className="space-y-6">
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 font-semibold text-gray-900">Monthly Churn Analysis</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-900">Month</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900">Canceled</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900">Updated</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900">Renewals</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {churnData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                        No churn data available
                      </td>
                    </tr>
                  ) : (
                    churnData.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-gray-900">{row.month}</td>
                        <td className="px-4 py-2 text-right text-red-600 font-medium">
                          {row.canceled_count}
                        </td>
                        <td className="px-4 py-2 text-right text-blue-600 font-medium">
                          {row.updated_count}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600 font-medium">
                          {row.successful_renewals}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MetricCard Component
 */
function MetricCard({ title, value, icon, color }) {
  const colorClasses = {
    red: "bg-red-50 text-red-900",
    orange: "bg-orange-50 text-orange-900",
    yellow: "bg-yellow-50 text-yellow-900",
    green: "bg-green-50 text-green-900",
  };

  return (
    <div className={`rounded-lg p-6 ${colorClasses[color] || colorClasses.red}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
}

/**
 * StatusBadge Component
 */
function StatusBadge({ status }) {
  const statusConfig = {
    pending: { bg: "bg-red-100", text: "text-red-800" },
    retrying: { bg: "bg-yellow-100", text: "text-yellow-800" },
    resolved: { bg: "bg-blue-100", text: "text-blue-800" },
    forgiven: { bg: "bg-green-100", text: "text-green-800" },
    canceled: { bg: "bg-gray-100", text: "text-gray-800" },
    subscription_canceled: { bg: "bg-purple-100", text: "text-purple-800" },
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {status.replace("_", " ")}
    </span>
  );
}
