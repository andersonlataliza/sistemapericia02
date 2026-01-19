import React, { useState } from 'react';
import { exportReportAsPdf } from '@/lib/export';

export function TesteImagemPDF() {
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log(msg);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testarPDFComImagem = async () => {
    setLoading(true);
    setDebugInfo([]);
    
    try {
      addDebug('Iniciando teste de PDF com imagem...');
      
      // Criar uma imagem de teste simples (quadrado colorido)
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Desenhar um quadrado com gradiente
        const gradient = ctx.createLinearGradient(0, 0, 200, 100);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, '#0000ff');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 200, 100);
        
        // Adicionar texto
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText('TESTE IMAGEM', 40, 60);
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      addDebug(`Imagem de teste criada: ${dataUrl.substring(0, 50)}...`);
      
      // Dados do processo com configuração de imagem
      const processData = {
        process_number: '12345',
        claimant_name: 'Teste Reclamante',
        defendant_name: 'Teste Reclamada',
        court: '1ª Vara do Trabalho',
        objective: 'Teste de geração de PDF com imagem',
        report_config: {
          header: {
            peritoName: 'Perito Teste',
            professionalTitle: 'Engenheiro Teste',
            registrationNumber: 'CREA 123456',
            imageDataUrl: dataUrl,
            imageWidth: 150,
            imageHeight: 75
          },
          footer: {
            contactEmail: 'teste@email.com',
            imageDataUrl: dataUrl,
            imageWidth: 100,
            imageHeight: 50
          }
        }
      };
      
      addDebug('Gerando PDF...');
      await exportReportAsPdf('', processData);
      addDebug('PDF gerado com sucesso!');
      
    } catch (error) {
      addDebug(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Erro completo:', error);
    } finally {
      setLoading(false);
    }
  };

  const testarPDFSemImagem = async () => {
    setLoading(true);
    setDebugInfo([]);
    
    try {
      addDebug('Iniciando teste de PDF sem imagem...');
      
      const processData = {
        process_number: '12345',
        claimant_name: 'Teste Reclamante',
        defendant_name: 'Teste Reclamada',
        court: '1ª Vara do Trabalho',
        objective: 'Teste de geração de PDF sem imagem'
      };
      
      addDebug('Gerando PDF...');
      await exportReportAsPdf('', processData);
      addDebug('PDF gerado com sucesso!');
      
    } catch (error) {
      addDebug(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
      console.error('Erro completo:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">Teste de Geração de PDF</h2>
      
      <div className="space-y-4 mb-6">
        <button
          onClick={testarPDFComImagem}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Gerando...' : 'Testar PDF com Imagem'}
        </button>
        
        <button
          onClick={testarPDFSemImagem}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          {loading ? 'Gerando...' : 'Testar PDF sem Imagem'}
        </button>
      </div>

      <div className="border rounded p-4 bg-gray-50">
        <h3 className="font-bold mb-2">Log de Debug:</h3>
        <div className="h-64 overflow-y-auto font-mono text-sm">
          {debugInfo.length === 0 ? (
            <p className="text-gray-500">Aguardando execução...</p>
          ) : (
            debugInfo.map((log, index) => (
              <div key={index} className="mb-1">
                {log.startsWith('ERRO:') ? (
                  <span className="text-red-600">{log}</span>
                ) : (
                  <span>{log}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}