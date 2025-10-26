import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/layout/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function NewProcess() {
  const [loading, setLoading] = useState(false);
  const [processNumber, setProcessNumber] = useState("");
  const [claimantName, setClaimantName] = useState("");
  const [defendantName, setDefendantName] = useState("");
  const [court, setCourt] = useState("");
  const [inspectionDate, setInspectionDate] = useState<Date>();
  const [inspectionAddress, setInspectionAddress] = useState("");
  const [initialType, setInitialType] = useState<"insalubridade" | "periculosidade" | "acidentario">("insalubridade");
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("processes")
        .insert({
          process_number: processNumber,
          claimant_name: claimantName,
          defendant_name: defendantName,
          court,
          inspection_date: inspectionDate?.toISOString(),
          inspection_address: inspectionAddress,
          user_id: user.id,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Processo criado com sucesso",
        description: `Processo ${processNumber} foi cadastrado`,
      });

      navigate(`/processo/${data.id}`);
    } catch (error: any) {
      toast({
        title: "Erro ao criar processo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Novo Processo</h1>
            <p className="text-muted-foreground">
              Cadastre um novo processo pericial trabalhista
            </p>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Dados do Processo</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="processNumber">Número do Processo *</Label>
                  <Input
                    id="processNumber"
                    placeholder="0000000-00.0000.0.00.0000"
                    value={processNumber}
                    onChange={(e) => setProcessNumber(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claimantName">Nome do(a) Reclamante *</Label>
                  <Input
                    id="claimantName"
                    placeholder="Nome completo do reclamante"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defendantName">Nome do(a) Reclamado(a) *</Label>
                  <Input
                    id="defendantName"
                    placeholder="Nome completo ou razão social"
                    value={defendantName}
                    onChange={(e) => setDefendantName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="court">Vara Trabalhista</Label>
                  <Input
                    id="court"
                    placeholder="Ex: 1ª Vara do Trabalho de São Paulo"
                    value={court}
                    onChange={(e) => setCourt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data da Perícia</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {inspectionDate ? (
                          format(inspectionDate, "PPP", { locale: ptBR })
                        ) : (
                          <span>Selecione uma data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={inspectionDate}
                        onSelect={setInspectionDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspectionAddress">Endereço da Perícia</Label>
                  <Textarea
                    id="inspectionAddress"
                    placeholder="Endereço completo onde será realizada a perícia"
                    value={inspectionAddress}
                    onChange={(e) => setInspectionAddress(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Perícia</Label>
                  <RadioGroup
                    value={initialType}
                    onValueChange={(val) => setInitialType(val as any)}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2"
                  >
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="insalubridade" id="tipo-insal" />
                      <Label htmlFor="tipo-insal">Insalubridade</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="periculosidade" id="tipo-peri" />
                      <Label htmlFor="tipo-peri">Periculosidade</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2">
                      <RadioGroupItem value="acidentario" id="tipo-aci" />
                      <Label htmlFor="tipo-aci">Acidentário</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="flex space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/processos")}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? "Criando..." : "Criar Processo"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
