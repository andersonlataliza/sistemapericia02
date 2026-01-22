import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  File, 
  Download, 
  Trash2, 
  Eye, 
  FileText, 
  Image, 
  FileArchive,
  Loader2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface DocumentViewerProps {
  processId?: string;
  bucketName: 'process-documents' | 'avatars' | 'report-templates';
  onDocumentDeleted?: (documentId: string) => void;
  className?: string;
  readOnly?: boolean;
}

export default function DocumentViewer({
  processId,
  bucketName,
  onDocumentDeleted,
  className = '',
  readOnly = false,
}: DocumentViewerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      if (bucketName === 'process-documents' && processId) {
        // Fetch documents from database for process documents
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('process_id', processId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Map database documents to Document interface
        const mappedDocuments: Document[] = (data || []).map(doc => ({
          id: doc.id,
          name: doc.name,
          file_path: doc.file_path,
          file_size: doc.file_size,
          file_type: doc.file_type,
          category: doc.category || 'other', // Use category from database or default
          created_at: doc.created_at,
          updated_at: doc.updated_at
        }));
        
        setDocuments(mappedDocuments);
      } else {
        // For other buckets, list files directly from storage
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Usuário não autenticado');

        const { data, error } = await supabase.storage
          .from(bucketName)
          .list(user.id, {
            limit: 100,
            offset: 0,
            sortBy: { column: 'created_at', order: 'desc' }
          });

        if (error) throw error;

        // Convert storage objects to document format
        const storageDocuments: Document[] = (data || []).map(file => ({
          id: file.name,
          name: file.name,
          file_path: `${user.id}/${file.name}`,
          file_size: file.metadata?.size || 0,
          file_type: file.metadata?.mimetype || 'application/octet-stream',
          category: 'other',
          created_at: file.created_at || new Date().toISOString(),
          updated_at: file.updated_at || new Date().toISOString()
        }));

        setDocuments(storageDocuments);
      }
    } catch (error: any) {
      console.error('Erro ao carregar documentos:', error);
      toast({
        title: 'Erro ao carregar documentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [processId, bucketName]);

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (fileType.includes('pdf') || fileType.includes('document')) {
      return <FileText className="h-4 w-4" />;
    } else if (fileType.includes('zip') || fileType.includes('archive')) {
      return <FileArchive className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'initial_petition': return 'bg-blue-100 text-blue-800';
      case 'defense': return 'bg-green-100 text-green-800';
      case 'evidence': return 'bg-yellow-100 text-yellow-800';
      case 'photo': return 'bg-purple-100 text-purple-800';
      case 'measurement': return 'bg-orange-100 text-orange-800';
      case 'report': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'initial_petition': 'Petição Inicial',
      'defense': 'Defesa',
      'evidence': 'Prova',
      'photo': 'Foto',
      'measurement': 'Medição',
      'report': 'Relatório',
      'other': 'Outro'
    };
    return labels[category] || category;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const downloadFile = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(document.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.name;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download iniciado',
        description: `Baixando "${document.name}"...`,
      });
    } catch (error: any) {
      console.error('Erro no download:', error);
      toast({
        title: 'Erro no download',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteDocument = async (document: Document) => {
    try {
      setDeletingId(document.id);

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(bucketName)
        .remove([document.file_path]);

      if (storageError) throw storageError;

      // Delete from database if it's a process document
      if (bucketName === 'process-documents') {
        const { error: dbError } = await supabase
          .from('documents')
          .delete()
          .eq('id', document.id);

        if (dbError) {
          console.error('Erro ao deletar do banco:', dbError);
          // Don't throw here, file was deleted from storage
        }
      }

      // Update local state
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));

      if (onDocumentDeleted) {
        onDocumentDeleted(document.id);
      }

      toast({
        title: 'Documento excluído',
        description: `"${document.name}" foi removido com sucesso.`,
      });
    } catch (error: any) {
      console.error('Erro ao excluir documento:', error);
      toast({
        title: 'Erro ao excluir documento',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const previewFile = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(document.file_path, 3600); // 1 hour expiry

      if (error) throw error;

      // Open in new tab
      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Erro na visualização:', error);
      toast({
        title: 'Erro na visualização',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Carregando documentos...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <File className="h-5 w-5" />
          Documentos ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <File className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum documento encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getFileIcon(document.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{document.name}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{formatFileSize(document.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(document.created_at).toLocaleDateString('pt-BR')}</span>
                      {bucketName === 'process-documents' && (
                        <>
                          <span>•</span>
                          <Badge 
                            variant="secondary" 
                            className={getCategoryBadgeColor(document.category)}
                          >
                            {getCategoryLabel(document.category)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => previewFile(document)}
                    title="Visualizar"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadFile(document)}
                    title="Baixar"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {!readOnly && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deletingId === document.id}
                          title="Excluir"
                        >
                          {deletingId === document.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o documento "{document.name}"?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDocument(document)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
