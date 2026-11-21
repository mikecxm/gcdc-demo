import React, { useEffect, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileText } from 'lucide-react';

interface PdfViewerProps {
  pdfUrl: string;
  title: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ pdfUrl, title }) => {
  const [viewerError, setViewerError] = useState(false);

  useEffect(() => {
    setViewerError(false);
  }, [pdfUrl]);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          Manuscrito Adjunto (Visor de PDF)
        </h3>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline self-start sm:self-auto"
        >
          <span>Abrir en pestaña nueva</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-inner">
        {viewerError ? (
          <div className="flex flex-col items-center justify-center gap-4 h-48 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-400" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-700">
                El visor integrado no pudo renderizar el PDF
              </p>
              <p className="text-xs text-slate-500">
                Esto puede ocurrir por restricciones del navegador o del servidor de origen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir en nueva pestaña
              </a>
              <a
                href={pdfUrl}
                download
                className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </a>
            </div>
          </div>
        ) : (
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-80 sm:h-96 md:h-[480px]"
            aria-label={`Manuscrito PDF: ${title}`}
            onError={() => setViewerError(true)}
          >
            <embed
              src={pdfUrl}
              type="application/pdf"
              className="w-full h-80 sm:h-96 md:h-[480px]"
              onError={() => setViewerError(true)}
            />
            <div className="flex flex-col items-center justify-center gap-3 h-48 p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-xs text-slate-500">
                Tu navegador no soporta la visualización directa de PDF.{' '}
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 font-semibold underline"
                >
                  Haz clic aquí para ver o descargar el documento.
                </a>
              </p>
            </div>
          </object>
        )}
      </div>
      <p className="text-[11px] text-slate-400 italic">
        * El documento se muestra en modo de solo lectura para la revisión del Comité Científico. Si
        el visor no carga, usa los botones de la barra inferior para abrirlo o descargarlo.
      </p>
    </div>
  );
};

export default PdfViewer;
