import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, X, CheckCircle, AlertCircle, FileText, Eye } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { extractDocumentTextOCR } from '@/lib/llm';

interface FileUploadProps {
  bucketName: 'process-documents' | 'avatars' | 'report-templates';
  processId?: string;
  targetUserId?: string;
  onUploadComplete?: (filePath: string, fileName: string, extractedText?: string) => void;
  onUploadError?: (error: string) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number; // in bytes
  multiple?: boolean;
  className?: string;
  enableTextExtraction?: boolean;
  pathPrefix?: string;
  getTargetFileName?: (file: File) => string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error' | 'processing';
  error?: string;
  filePath?: string;
  extractedText?: string;
  isProcessingText?: boolean;
}

export default function FileUpload({
  bucketName,
  processId,
  targetUserId,
  onUploadComplete,
  onUploadError,
  acceptedFileTypes = ['*/*'],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  multiple = false,
  className = '',
  enableTextExtraction = false,
  pathPrefix,
  getTargetFileName,
}: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxFileSize) {
      return `Arquivo muito grande. Tamanho máximo: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
    }

    // Check file type if specified
    if (acceptedFileTypes.length > 0 && !acceptedFileTypes.includes('*/*')) {
      const fileType = file.type;
      const isAccepted = acceptedFileTypes.some(type => {
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.slice(0, -1));
        }
        return fileType === type;
      });

      if (!isAccepted) {
        return `Tipo de arquivo não permitido. Tipos aceitos: ${acceptedFileTypes.join(', ')}`;
      }
    }

    return null;
  };

  const generateFilePath = (userId: string, fileName: string): string => {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    if (bucketName === 'process-documents' && processId) {
      return `${userId}/${processId}/${timestamp}_${sanitizedFileName}`;
    } else if (bucketName === 'avatars') {
      return `${userId}/avatar_${timestamp}_${sanitizedFileName}`;
    } else {
      const prefix = String(pathPrefix || '').trim().replace(/^\/+|\/+$/g, '');
      return prefix ? `${userId}/${prefix}/${timestamp}_${sanitizedFileName}` : `${userId}/${timestamp}_${sanitizedFileName}`;
    }
  };

  const uploadFile = async (file: File): Promise<void> => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      const targetFileName = getTargetFileName ? getTargetFileName(file) : file.name;

      // Generate file path
      const filePath = generateFilePath(targetUserId || user.id, targetFileName);

      // Update uploading state
      setUploadingFiles(prev => prev.map(f => 
        f.file === file ? { ...f, progress: 10 } : f
      ));

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        const errAny = error as any;
        const parts = [error?.name, (error as any)?.status ?? errAny?.statusCode, error?.message, errAny?.error]
          .filter(Boolean)
          .join(" | ");
        toast({ title: 'Erro no upload', description: parts, variant: 'destructive' });
        throw error;
      }

      // Update progress to complete
      setUploadingFiles(prev => prev.map(f => 
        f.file === file ? { 
          ...f, 
          progress: 100, 
          status: 'completed' as const,
          filePath: data.path
        } : f
      ));

      let extractedText: string | undefined;

      // Extract text if enabled and file is a document
      if (enableTextExtraction && (file.type.includes('pdf') || file.type.includes('document') || file.type.includes('text'))) {
        try {
          // Update status to processing
          setUploadingFiles(prev => prev.map(f => 
            f.file === file ? { 
              ...f, 
              status: 'processing' as const,
              isProcessingText: true
            } : f
          ));

          extractedText = await extractDocumentTextOCR(file);
          
          // Update with extracted text
          setUploadingFiles(prev => prev.map(f => 
            f.file === file ? { 
              ...f, 
              status: 'completed' as const,
              isProcessingText: false,
              extractedText: extractedText || undefined
            } : f
          ));

          if (extractedText) {
            toast({
              title: 'Texto extraído',
              description: `Texto extraído do documento "${file.name}".`,
            });
          }
        } catch (textError) {
          console.error('Erro na extração de texto:', textError);
          // Don't fail the upload, just log the error
          setUploadingFiles(prev => prev.map(f => 
            f.file === file ? { 
              ...f, 
              status: 'completed' as const,
              isProcessingText: false
            } : f
          ));
        }
      }

      // If this is a document upload, save to documents table
      if (bucketName === 'process-documents' && processId) {
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            process_id: processId,
            name: file.name,
            file_path: data.path,
            file_size: file.size,
            file_type: file.type,
            category: 'other',
            description: extractedText || null,
          });

        if (dbError) {
          console.error('Erro ao salvar documento na base de dados:', dbError);
          // Don't throw here, file was uploaded successfully
        }
      }

      // Call success callback
      if (onUploadComplete) {
        onUploadComplete(data.path, targetFileName, extractedText);
      }

      toast({
        title: 'Upload concluído',
        description: `Arquivo "${targetFileName}" enviado com sucesso.`,
      });

    } catch (error: any) {
      console.error('Erro no upload:', error);
      const errAny = error as any;
      const parts = [error?.name, errAny?.status ?? errAny?.statusCode, error?.message, errAny?.error]
        .filter(Boolean)
        .join(" | ");
      
      setUploadingFiles(prev => prev.map(f => 
        f.file === file ? { 
          ...f, 
          status: 'error' as const,
          error: error.message
        } : f
      ));

      if (onUploadError) {
        onUploadError(parts || error.message);
      }

      toast({
        title: 'Erro no upload',
        description: parts || error.message,
        variant: 'destructive',
      });
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    
    // Validate each file
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        toast({
          title: 'Arquivo inválido',
          description: `${file.name}: ${validationError}`,
          variant: 'destructive',
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Add files to uploading state
    const newUploadingFiles: UploadingFile[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Start uploading each file
    validFiles.forEach(file => {
      uploadFile(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (fileToRemove: UploadingFile) => {
    setUploadingFiles(prev => prev.filter(f => f.file !== fileToRemove.file));
  };

  const clearCompleted = () => {
    setUploadingFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload de Arquivos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragOver 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium mb-2">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Tamanho máximo: {(maxFileSize / 1024 / 1024).toFixed(1)}MB
            {acceptedFileTypes.length > 0 && !acceptedFileTypes.includes('*/*') && (
              <span className="block">
                Tipos aceitos: {acceptedFileTypes.join(', ')}
              </span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Selecionar Arquivos
          </Button>
          <Input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple={multiple}
            accept={acceptedFileTypes.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
          />
        </div>

        {/* Uploading Files List */}
        {uploadingFiles.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Arquivos</Label>
              {uploadingFiles.some(f => f.status === 'completed') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                >
                  Limpar concluídos
                </Button>
              )}
            </div>
            
            {uploadingFiles.map((uploadingFile, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    <span className="text-sm font-medium truncate">
                      {uploadingFile.file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {uploadingFile.status === 'completed' && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                    {uploadingFile.status === 'processing' && (
                      <FileText className="h-4 w-4 text-blue-500 animate-pulse" />
                    )}
                    {uploadingFile.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    {uploadingFile.extractedText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(uploadingFile.extractedText!);
                          toast({
                            title: 'Texto copiado',
                            description: 'Texto extraído copiado para a área de transferência.',
                          });
                        }}
                        title="Copiar texto extraído"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(uploadingFile)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {uploadingFile.status === 'uploading' && (
                  <Progress value={uploadingFile.progress} className="h-2" />
                )}
                
                {uploadingFile.status === 'processing' && (
                  <div className="space-y-1">
                    <Progress value={100} className="h-2 animate-pulse" />
                    <p className="text-xs text-blue-600">Processando documento e extraindo texto...</p>
                  </div>
                )}
                
                {uploadingFile.status === 'error' && uploadingFile.error && (
                  <p className="text-xs text-red-500">{uploadingFile.error}</p>
                )}
                
                {uploadingFile.extractedText && (
                  <div className="bg-muted/50 p-2 rounded text-xs">
                    <p className="font-medium text-green-600 mb-1">Texto extraído:</p>
                    <p className="text-muted-foreground line-clamp-3">
                      {uploadingFile.extractedText.substring(0, 150)}
                      {uploadingFile.extractedText.length > 150 ? '...' : ''}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
