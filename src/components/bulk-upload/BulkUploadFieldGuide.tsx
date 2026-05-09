import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info } from "lucide-react";

export interface FieldInfo {
  name: string;
  required: boolean;
  description: string;
  format?: string;
  validValues?: string[];
}

interface BulkUploadFieldGuideProps {
  fields: FieldInfo[];
  tips?: string[];
}

export function BulkUploadFieldGuide({ fields, tips }: BulkUploadFieldGuideProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="h-4 w-4" />
          Column Guide
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Column Name</TableHead>
                <TableHead className="w-[100px]">Required</TableHead>
                <TableHead>Description & Format</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.name}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>
                    {field.required ? (
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{field.description}</div>
                    {field.format && (
                      <div className="text-muted-foreground mt-1">
                        <span className="font-medium">Format:</span> {field.format}
                      </div>
                    )}
                    {field.validValues && field.validValues.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-muted-foreground font-medium">Valid values:</span>
                        {field.validValues.map((value) => (
                          <Badge key={value} variant="outline" className="text-xs">
                            {value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {tips && tips.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm mb-2">Tips for Successful Upload</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {tips.map((tip, index) => (
                <li key={index}>• {tip}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
