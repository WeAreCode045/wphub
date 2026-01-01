import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { entities } from "@/api/entities";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function ConnectorManagement() {
  const [selectedVersion, setSelectedVersion] = useState(null);

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  // Fetch available connector versions from Edge Function
  const { data: versions, isLoading, refetch } = useQuery({
    queryKey: ["connector-versions"],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/getConnectorVersions`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch connector versions");
      }

      const data = await response.json();
      return data.versions || [];
    },
  });

  // Get currently selected version
  const { data: currentVersion } = useQuery({
    queryKey: ["current-connector-version"],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connectorVersionSettings`,
        {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.success ? { version: data.version, url: data.url } : null;
    },
  });

  // Mutation to set selected version
  const { mutate: selectVersion, isPending: isSelecting } = useMutation({
    mutationFn: async (version) => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/connectorVersionSettings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ version: version.version, url: version.url }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to set connector version");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setSelectedVersion(data.version);
      // Show success message
      alert("Connector version updated successfully");
      refetch();
    },
  });

  const handleSelectVersion = (version) => {
    if (window.confirm(
      `Are you sure you want to switch to version ${version.version}?\nThe download link will be updated for all users.`
    )) {
      selectVersion(version);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Connector Plugin Management
          </h1>
          <p className="text-gray-600">
            Manage available WordPress connector plugin versions for download
          </p>
        </div>

        {/* Current Version Card */}
        {currentVersion && (
          <Card className="border-none shadow-md mb-6 border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Currently Selected Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Version</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {currentVersion.version}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    Download URL
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 bg-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                      {currentVersion.url}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(currentVersion.url)}
                      className="whitespace-nowrap"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="whitespace-nowrap"
                    >
                      <a
                        href={currentVersion.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available Versions */}
        <Card className="border-none shadow-md">
          <CardHeader className="border-b border-gray-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Available Versions
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : !versions || versions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No connector versions available yet</p>
                <p className="text-xs text-gray-400 mt-2">
                  Run the deploy script to upload connector versions
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {versions.map((version, idx) => (
                  <div
                    key={version.filename}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      currentVersion?.version === version.version
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className="bg-indigo-600">
                            v{version.version}
                          </Badge>
                          {currentVersion?.version === version.version && (
                            <Badge className="bg-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                          <div>
                            <p className="text-xs text-gray-600 mb-1">File</p>
                            <p className="font-mono text-xs text-gray-900">
                              {version.filename}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600 mb-1">Size</p>
                            <p className="text-gray-900">
                              {typeof version.size === "number"
                                ? formatFileSize(version.size)
                                : version.size}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600 mb-1">
                              Uploaded
                            </p>
                            <p className="text-gray-900">
                              {version.created_at
                                ? format(new Date(version.created_at), "d MMM yyyy HH:mm", {
                                    locale: nl,
                                  })
                                : "Unknown"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-gray-600 mb-1">URL</p>
                            <button
                              onClick={() => copyToClipboard(version.url)}
                              className="text-indigo-600 hover:text-indigo-700 text-xs font-medium flex items-center gap-1"
                            >
                              <Copy className="w-3 h-3" />
                              Copy
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          size="sm"
                          asChild
                          variant="outline"
                        >
                          <a
                            href={version.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </a>
                        </Button>

                        {currentVersion?.version !== version.version && (
                          <Button
                            size="sm"
                            onClick={() => handleSelectVersion(version)}
                            disabled={isSelecting}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            {isSelecting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Set Active
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Deployment Instructions Card */}
        <Card className="border-none shadow-md mt-6">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="text-lg">Deployment Instructions</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">
                  To deploy a new connector version:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>Update the version in wp-plugin/wp-plugin-hub-connector.php</li>
                  <li>Run the deployment script:</li>
                </ol>
                <code className="block bg-gray-900 text-gray-100 p-3 rounded-lg mt-3 text-xs overflow-x-auto">
                  ./scripts/deploy-connector.sh
                </code>
                <p className="text-gray-600 mt-2">
                  The script will create a ZIP file and upload it to Supabase storage.
                </p>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 mt-3">
                  <li>The new version will appear in the list above</li>
                  <li>Click "Set Active" to make it the default download version</li>
                </ol>
              </div>
            </div>

        {/* Environment Variables Note */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> The deployment script requires{" "}
            <code className="bg-blue-100 px-2 py-1 rounded text-xs">
              SUPABASE_URL
            </code>{" "}
            and{" "}
            <code className="bg-blue-100 px-2 py-1 rounded text-xs">
              SUPABASE_ANON_KEY
            </code>{" "}
            environment variables to be set.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</div>
);
}
