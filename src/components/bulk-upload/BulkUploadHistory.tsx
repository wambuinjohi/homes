import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginator } from "@/components/ui/table-paginator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Clock, CheckCircle, AlertCircle, Download } from "lucide-react";
import { getBulkUploadHistory } from "@/utils/bulkUploadAudit";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

export function BulkUploadHistory() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: uploadHistory = [], isLoading } = useQuery({
    queryKey: ['bulk-upload-history', user?.id],
    queryFn: () => getBulkUploadHistory(user?.id),
    enabled: !!user?.id
  });

  // Client-side pagination
  const totalItems = uploadHistory.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedHistory = uploadHistory.slice(startIndex, startIndex + pageSize);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upload History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading upload history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (uploadHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upload History
          </CardTitle>
          <CardDescription>
            Track your bulk upload operations and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">No uploads yet</p>
            <p className="text-muted-foreground">
              Your bulk upload history will appear here once you start uploading data.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (successful: number, failed: number) => {
    if (failed === 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Success</Badge>;
    } else if (successful === 0) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    } else {
      return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Upload History
        </CardTitle>
        <CardDescription>
          Recent bulk upload operations and their results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(upload.created_at).toLocaleDateString()} {new Date(upload.created_at).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {upload.operation_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{upload.file_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Total: {upload.total_records}</div>
                      <div className="text-green-600">Success: {upload.successful_records}</div>
                      {upload.failed_records > 0 && (
                        <div className="text-red-600">Failed: {upload.failed_records}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(upload.successful_records, upload.failed_records)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {upload.processing_time_ms}ms
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Download error report"
                      disabled={upload.failed_records === 0}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        
        {totalPages > 1 && (
          <div className="mt-4">
            <TablePaginator
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setCurrentPage}
              showPageSizeSelector={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}