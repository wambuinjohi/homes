import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, FileText, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface FieldMetadata {
  name: string;
  required: boolean;
  format?: string;
  validValues?: string[];
}

export interface BulkUploadProps {
  title: string;
  description: string;
  templateData: Array<Record<string, any>>;
  templateFileName: string;
  requiredFields: string[];
  fieldMetadata?: FieldMetadata[];
  onValidateData: (data: Array<Record<string, any>>) => Promise<ValidationError[]>;
  onImportData: (data: Array<Record<string, any>>) => Promise<void>;
  maxRecords?: number;
}

export function BulkUploadBase({
  title,
  description,
  templateData,
  templateFileName,
  requiredFields,
  fieldMetadata,
  onValidateData,
  onImportData,
  maxRecords = 5000
}: BulkUploadProps) {
  const [uploadedData, setUploadedData] = useState<Array<Record<string, any>>>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFileName(file.name);
    setUploadedData([]);
    setValidationErrors([]);

    try {
      let data: Array<Record<string, any>> = [];

      if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
          header: true,
          encoding: 'UTF-8',
          complete: (results) => {
            data = results.data as Array<Record<string, any>>;
            processUploadedData(data);
          },
          error: (error) => {
            toast({
              title: "Parse Error",
              description: `Failed to parse CSV: ${error.message}`,
              variant: "destructive",
            });
          }
        });
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Parse as array of arrays to handle multi-row headers
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length > 0) {
          // Detect if first row contains indicator markers like "(REQUIRED)" or "(Optional)"
          const firstRow = rawData[0] || [];
          const isIndicatorRow = firstRow.some((cell: any) => 
            String(cell || '').includes('(REQUIRED)') || String(cell || '').includes('(Optional)')
          );
          
          let headerRowIndex = 0;
          let dataStartIndex = 1;
          
          if (isIndicatorRow && rawData.length > 1) {
            // First row is indicators, second row is headers
            headerRowIndex = 1;
            dataStartIndex = 2;
            
            // Check if third row looks like format hints/guide row
            // These typically contain patterns like: "Valid:", "e.g.", "Must match", "Positive number", 
            // "Non-negative", "format", "Number (e.g.", "Text", "Comma-separated"
            if (rawData.length > 2) {
              const thirdRow = rawData[2] || [];
              const formatPatterns = [
                'Valid:', 'e.g.', 'e.g,', 'format', 'Positive number', 'Non-negative',
                'Must match', 'Number (', 'Text', 'Comma-separated', 'email@', 
                'max', 'characters', 'exactly', 'existing'
              ];
              
              const isFormatRow = thirdRow.some((cell: any) => {
                const cellStr = String(cell || '').toLowerCase();
                return formatPatterns.some(pattern => cellStr.includes(pattern.toLowerCase()));
              });
              
              if (isFormatRow) {
                dataStartIndex = 3;
              }
            }
          }
          
          const headers = (rawData[headerRowIndex] || []).map((h: any) => String(h || '').trim());
          
          // Convert remaining rows to objects using detected headers
          data = rawData.slice(dataStartIndex).map((row: any[]) => {
            const obj: Record<string, any> = {};
            headers.forEach((header, index) => {
              if (header) {
                obj[header] = row[index] ?? '';
              }
            });
            return obj;
          });
        }
        
        processUploadedData(data);
      }
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const processUploadedData = async (data: Array<Record<string, any>>) => {
    // Filter out empty rows
    const cleanData = data.filter(row => 
      Object.values(row).some(value => value !== null && value !== undefined && value !== '')
    );

    if (cleanData.length > maxRecords) {
      toast({
        title: "File Too Large",
        description: `Maximum ${maxRecords} records allowed per upload. Your file contains ${cleanData.length} records.`,
        variant: "destructive",
      });
      return;
    }

    setUploadedData(cleanData);
    
    if (cleanData.length > 0) {
      setIsValidating(true);
      try {
        const errors = await onValidateData(cleanData);
        setValidationErrors(errors);
      } catch (error) {
        toast({
          title: "Validation Error",
          description: "Failed to validate uploaded data",
          variant: "destructive",
        });
      } finally {
        setIsValidating(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const downloadTemplate = () => {
    if (!templateData.length) return;

    const headers = Object.keys(templateData[0]);
    
    // Build rows with field metadata if available
    const rows: any[][] = [];
    
    if (fieldMetadata && fieldMetadata.length > 0) {
      // Row 1: Required/Optional indicators
      const indicatorRow = headers.map(header => {
        const meta = fieldMetadata.find(f => f.name === header);
        return meta?.required ? "(REQUIRED)" : "(Optional)";
      });
      rows.push(indicatorRow);
      
      // Row 2: Column headers
      rows.push(headers);
      
      // Row 3: Format hints and valid values
      const formatRow = headers.map(header => {
        const meta = fieldMetadata.find(f => f.name === header);
        if (!meta) return "";
        
        let hint = meta.format || "";
        if (meta.validValues && meta.validValues.length > 0) {
          hint = `Valid: ${meta.validValues.join(", ")}`;
        }
        return hint;
      });
      rows.push(formatRow);
    } else {
      // Fallback: just headers with required indicators
      const indicatorRow = headers.map(header => 
        requiredFields.includes(header) ? "(REQUIRED)" : "(Optional)"
      );
      rows.push(indicatorRow);
      rows.push(headers);
    }
    
    // Add sample data rows
    templateData.forEach(record => {
      rows.push(headers.map(h => record[h] ?? ""));
    });
    
    // Create worksheet from array of arrays
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Set column widths for better readability
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 5, 15) }));
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, templateFileName);
  };

  const downloadErrorReport = () => {
    const errorReport = validationErrors.map(error => ({
      Row: error.row + 1,
      Field: error.field,
      Error: error.message
    }));
    
    const ws = XLSX.utils.json_to_sheet(errorReport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `error_report_${Date.now()}.xlsx`);
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Errors",
        description: "Please fix all validation errors before importing",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      await onImportData(uploadedData);
      
      clearInterval(progressInterval);
      setImportProgress(100);
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${uploadedData.length} records`,
      });

      // Clear data after successful import
      setTimeout(() => {
        setUploadedData([]);
        setFileName("");
        setImportProgress(0);
      }, 2000);

    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const hasValidationErrors = validationErrors.length > 0;
  const canImport = uploadedData.length > 0 && !hasValidationErrors && !isValidating;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={downloadTemplate} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <div className="text-sm text-muted-foreground">
              Supports CSV and Excel files. Maximum {maxRecords.toLocaleString()} records per upload.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg">Drop your file here...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">Drag and drop your file here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to select a file</p>
                <Badge variant="secondary">CSV, XLSX, XLS</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Progress and Status */}
      {(isValidating || isImporting) && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {isValidating ? 'Validating data...' : 'Importing data...'}
                </span>
              </div>
              {isImporting && <Progress value={importProgress} className="w-full" />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {uploadedData.length > 0 && !isValidating && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {hasValidationErrors ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Validation Errors Found
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Data Validated Successfully
                </>
              )}
            </CardTitle>
            <CardDescription>
              {fileName} - {uploadedData.length} records processed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasValidationErrors ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Found {validationErrors.length} validation error(s). Please fix these issues before importing.
                  <Button
                    onClick={downloadErrorReport}
                    variant="link"
                    size="sm"
                    className="ml-2 p-0 h-auto"
                  >
                    Download Error Report
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  All records passed validation and are ready for import.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleImport}
                disabled={!canImport || isImporting}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importing...' : `Import ${uploadedData.length} Records`}
              </Button>
              <Button
                onClick={() => {
                  setUploadedData([]);
                  setValidationErrors([]);
                  setFileName("");
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Preview */}
      {uploadedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Data Preview</CardTitle>
            <CardDescription>
              Showing first 10 records. Errors are highlighted in red.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {Object.keys(uploadedData[0] || {}).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedData.slice(0, 10).map((row, index) => {
                    const rowErrors = validationErrors.filter(error => error.row === index);
                    return (
                      <TableRow key={index} className={rowErrors.length > 0 ? "bg-destructive/5" : ""}>
                        <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                        {Object.entries(row).map(([key, value]) => {
                          const fieldError = rowErrors.find(error => error.field === key);
                          return (
                            <TableCell
                              key={key}
                              className={fieldError ? "text-destructive border-destructive border" : ""}
                              title={fieldError?.message}
                            >
                              {String(value || '')}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {uploadedData.length > 10 && (
                <div className="text-center text-sm text-muted-foreground mt-4">
                  And {uploadedData.length - 10} more records...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}