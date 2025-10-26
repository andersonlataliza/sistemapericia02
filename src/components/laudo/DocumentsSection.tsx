import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface Document {
  name: string;
  presented: boolean;
  obs?: string;
}

interface DocumentsSectionProps {
  value: Document[];
  onChange: (value: Document[]) => void;
}

const defaultDocuments = [
  { name: 'FICHA DE EPIS', presented: false, obs: '' },
  { name: 'LTCAT', presented: false, obs: '' },
  { name: 'PCMSO', presented: false, obs: '' },
  { name: 'PGR', presented: false, obs: '' },
  { name: 'PPP', presented: false, obs: '' },
];

export default function DocumentsSection({ value, onChange }: DocumentsSectionProps) {
  const documents = value.length > 0 ? value : defaultDocuments;

  const addDocument = () => {
    onChange([...documents, { name: '', presented: false, obs: '' }]);
  };

  const removeDocument = (index: number) => {
    onChange(documents.filter((_, i) => i !== index));
  };

  const updateDocument = (index: number, field: keyof Document, fieldValue: string | boolean) => {
    const updatedDocs = [...documents];
    updatedDocs[index] = { ...updatedDocs[index], [field]: fieldValue };
    onChange(updatedDocs);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>10. Documentações Apresentadas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={addDocument} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Documento
          </Button>
        </div>

        <div className="space-y-3">
          {documents.map((doc, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`doc-${index}`}
                  checked={doc.presented}
                  onCheckedChange={(checked) => 
                    updateDocument(index, 'presented', checked === true)
                  }
                  className="mt-2"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={doc.name}
                      onChange={(e) => updateDocument(index, 'name', e.target.value)}
                      placeholder="Nome do documento"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => removeDocument(index)}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div>
                    <Input
                      value={doc.obs || ''}
                      onChange={(e) => updateDocument(index, 'obs', e.target.value)}
                      placeholder="Observações (opcional)"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}