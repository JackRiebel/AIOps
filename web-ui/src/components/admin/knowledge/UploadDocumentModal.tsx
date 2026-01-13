'use client';

import { memo, useState, useRef, useCallback } from 'react';
import { X, Upload, Globe, RefreshCw, BookOpen } from 'lucide-react';
import { DOC_TYPES, PRODUCTS, type UploadMetadata } from './types';

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: (file: File, metadata: UploadMetadata) => Promise<void>;
  onImportUrl: (url: string, metadata: UploadMetadata) => Promise<void>;
}

const initialMetadata: UploadMetadata = {
  doc_type: 'guide',
  product: '',
  title: '',
  description: '',
  version: '',
};

export const UploadDocumentModal = memo(({
  isOpen,
  onClose,
  onUploadFile,
  onImportUrl,
}: UploadDocumentModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'file' | 'url'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [metadata, setMetadata] = useState<UploadMetadata>(initialMetadata);
  const [uploading, setUploading] = useState(false);

  const resetState = useCallback(() => {
    setImportMode('file');
    setUploadFile(null);
    setImportUrl('');
    setMetadata(initialMetadata);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleUpload = useCallback(async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      await onUploadFile(uploadFile, metadata);
      handleClose();
    } finally {
      setUploading(false);
    }
  }, [uploadFile, metadata, onUploadFile, handleClose]);

  const handleUrlImport = useCallback(async () => {
    if (!importUrl.trim()) return;
    setUploading(true);
    try {
      await onImportUrl(importUrl.trim(), metadata);
      handleClose();
    } finally {
      setUploading(false);
    }
  }, [importUrl, metadata, onImportUrl, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-2xl w-full max-w-md">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Add Document</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="px-4 pt-4 flex gap-2">
          <button
            onClick={() => setImportMode('file')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              importMode === 'file'
                ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30'
                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
          <button
            onClick={() => setImportMode('url')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              importMode === 'url'
                ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border border-transparent'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Import from URL
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* File input */}
          {importMode === 'file' && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                File (.txt, .md, .json, .pdf)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.pdf,.docx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-medium file:bg-cyan-50 file:text-cyan-700 dark:file:bg-cyan-500/10 dark:file:text-cyan-400"
              />
            </div>
          )}

          {/* URL input */}
          {importMode === 'url' && (
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                Webpage URL
              </label>
              <input
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://example.com/docs/guide"
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Supports HTML pages, JSON (including OpenAPI specs), and plain text
              </p>
            </div>
          )}

          {/* Two-column layout for Type and Product */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Type *</label>
              <select
                value={metadata.doc_type}
                onChange={(e) => setMetadata(prev => ({ ...prev, doc_type: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {DOC_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Product</label>
              <select
                value={metadata.product}
                onChange={(e) => setMetadata(prev => ({ ...prev, product: e.target.value }))}
                className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">Select...</option>
                {PRODUCTS.map(prod => (
                  <option key={prod.value} value={prod.value}>{prod.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Title {importMode === 'url' && <span className="font-normal text-slate-400">(auto-detected if empty)</span>}
            </label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Document title"
              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea
              value={metadata.description}
              onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description"
              rows={2}
              className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
            />
          </div>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700/50 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </button>
          {importMode === 'file' ? (
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleUrlImport}
              disabled={!importUrl.trim() || uploading}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" />
                  Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

UploadDocumentModal.displayName = 'UploadDocumentModal';

export default UploadDocumentModal;
