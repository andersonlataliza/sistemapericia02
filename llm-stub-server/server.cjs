const express = require('express');
const cors = require('cors');
const multer = require('multer');

const app = express();
const port = 4000;

app.use(cors({ origin: 'http://localhost:8081' }));
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.post('/audio-activities', upload.single('file'), (req, res) => {
  const task = req.body?.task || 'activities';
  if (task === 'activities') {
    const content = [
      'Operador realiza corte com serra circular em bancada.',
      'Limpeza de área com varredura e recolhimento de resíduos.',
      'Transporte de materiais com carrinho manual.',
    ].join('\n');
    return res.json({ content });
  } else if (task === 'attendees') {
    return res.json({ items: ['Operador', 'Supervisor', 'Auxiliar'] });
  }
  return res.json({ content: 'Tarefa não especificada.' });
});

app.post('/epi-usage', (req, res) => {
  const { activities, epis } = req.body || {};
  const episList = Array.isArray(epis) ? epis : [];
  const activitiesText = typeof activities === 'string' ? activities : '';
  const header = 'Conforme a Portaria nº 3214/78 e a NR-6.';
  const tasksSec = 'Tarefas:\n' + (activitiesText ? activitiesText : '(sem descrição)');
  const episSec = 'EPIs requeridos:\n' + (episList.length ? episList.map(e => `- ${e.equipment} (${e.protection}) CA ${e.ca}`).join('\n') : '- Definir conforme risco identificado');
  const signalsSec = 'Sinalização/condições:\n- Usar EPIs ao operar máquinas.\n- Utilizar proteção auditiva acima de 85 dB.';
  const content = [header, tasksSec, episSec, signalsSec, 'Observações:\n- Resultado gerado por servidor stub. Ajuste conforme necessário.'].join('\n\n');
  return res.json({ content });
});

app.post('/ocr', upload.single('file'), (req, res) => {
  const text = 'Texto OCR simulado: Procedimentos indicam inspeção semanal dos protetores auriculares e substituição trimestral das luvas nitrílicas.';
  return res.json({ text });
});

// EPI periodicity evaluation endpoint
app.post('/epi-periodicity', upload.single('document'), (req, res) => {
  console.log('POST /epi-periodicity - Document received:', req.file?.originalname);
  
  // Simulate document text extraction and EPI periodicity evaluation
  const mockResponse = `Baseado na análise do documento fornecido, foram identificadas as seguintes periodicidades recomendadas para substituição de EPIs:

• Capacete de segurança: 24 meses (conforme CA válido)
• Óculos de proteção: 12 meses (devido ao desgaste por uso contínuo)
• Protetor auricular: 6 meses (higiene e eficácia)
• Luvas de segurança: 3 meses (desgaste por manuseio)
• Calçado de segurança: 12 meses (solado e estrutura)
• Cinto de segurança: 60 meses (conforme norma NBR)

Observações importantes:
- Periodicidades podem variar conforme intensidade de uso
- Inspeções visuais devem ser realizadas mensalmente
- Substituição imediata em caso de danos visíveis`;

  res.json({ content: mockResponse });
});

// Audio transcription endpoint
app.post('/audio-transcription', upload.single('audio'), (req, res) => {
  console.log('POST /audio-transcription - Audio received:', req.file?.originalname);
  
  // Simulate audio transcription
  const mockTranscription = `Durante a inspeção realizada no local de trabalho, observei que os funcionários estão utilizando os seguintes equipamentos de proteção individual: capacete de segurança classe A, óculos de proteção contra impactos, protetor auricular tipo concha, luvas de vaqueta para proteção das mãos, calçado de segurança com biqueira de aço e cinto de segurança para trabalho em altura.

Foi verificado que alguns trabalhadores não estavam utilizando adequadamente os protetores auriculares durante a operação de máquinas com alto nível de ruído. Também foi observado que as luvas de alguns funcionários apresentavam sinais de desgaste excessivo, necessitando substituição imediata.

O supervisor informou que a empresa realiza treinamentos mensais sobre o uso correto dos EPIs e que há um cronograma de substituição estabelecido conforme as recomendações do fabricante e normas técnicas aplicáveis.`;

  res.json({ transcription: mockTranscription });
});

app.listen(port, () => {
  console.log(`LLM stub server listening on http://localhost:${port}`);
});