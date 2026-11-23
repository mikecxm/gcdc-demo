import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import {
	ArrowLeft,
	Check,
	CheckCircle2,
	FileText,
	FileUp,
	Pencil,
	Plus,
	Trash2,
	Upload,
	X,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { getThematicLines, getArticleApiErrorMessage, type ThematicLine } from '../../services/articlesApi';
import publishArticleAnimation from '../../assets/publish-article-animate (1).svg';

const MAX_PDF_SIZE = 10 * 1024 * 1024;

const articleSubmissionSchema = z.object({
	title: z.string().trim().min(5, 'El título debe tener al menos 5 caracteres.').max(255, 'El título admite hasta 255 caracteres.'),
	abstract: z.string().min(20, 'El resumen debe tener al menos 20 caracteres.'),
	keywords: z
		.string()
		.min(3, 'Ingresa al menos 3 caracteres en las palabras clave.')
		.max(255, 'Las palabras clave admiten hasta 255 caracteres.'),
	topicLine: z.string().min(1, 'Selecciona una línea temática.'),
	coauthors: z.array(
		z.object({
			name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.'),
			affiliation: z
				.string()
				.min(2, 'La afiliación debe tener al menos 2 caracteres.'),
			email: z.string().email('Ingresa un correo electrónico válido.'),
		})
	),
});

type ArticleSubmissionValues = z.infer<typeof articleSubmissionSchema>;

const formatFileSize = (size: number) => (size / (1024 * 1024)).toFixed(2);

export const ArticleSubmissionForm = ({ onBackToMenu }: { onBackToMenu: () => void }) => {
	const [thematicLines, setThematicLines] = useState<ThematicLine[]>([]);
	const [topicsError, setTopicsError] = useState<string | null>(null);
	const [submissionError, setSubmissionError] = useState<string | null>(null);
	useEffect(() => {
		const controller = new AbortController();
		getThematicLines(controller.signal).then(setThematicLines).catch((error: unknown) => {
			if (!controller.signal.aborted) setTopicsError(getArticleApiErrorMessage(error));
		});
		return () => controller.abort();
	}, []);
	const [pdfFile, setPdfFile] = useState<File | null>(null);
	const [pdfError, setPdfError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [hasMoreFormContent, setHasMoreFormContent] = useState(false);
	const [confirmedCoauthors, setConfirmedCoauthors] = useState<Set<string>>(() => new Set());
	const fileInputRef = useRef<HTMLInputElement>(null);
	const formScrollRef = useRef<HTMLDivElement>(null);
	const successDialogRef = useRef<HTMLDivElement>(null);
	const successCloseButtonRef = useRef<HTMLButtonElement>(null);
	const submitButtonRef = useRef<HTMLButtonElement>(null);
	const successDialogWasOpen = useRef(false);

	const {
		register,
		control,
		handleSubmit,
		trigger,
		reset,
		formState: { errors, isSubmitting, touchedFields, dirtyFields },
	} = useForm<ArticleSubmissionValues>({
		resolver: zodResolver(articleSubmissionSchema),
		mode: 'onChange',
		defaultValues: {
			title: '',
			abstract: '',
			keywords: '',
			topicLine: '',
			coauthors: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: 'coauthors',
	});
	const hasUnconfirmedCoauthors = fields.some((field) => !confirmedCoauthors.has(field.id));

	const watchedTitle = useWatch({ control, name: 'title' });
	const watchedAbstract = useWatch({ control, name: 'abstract' });
	const watchedKeywords = useWatch({ control, name: 'keywords' });
	const watchedTopicLine = useWatch({ control, name: 'topicLine' });
	const isRequiredFieldValid = (
		fieldName: 'title' | 'abstract' | 'keywords' | 'topicLine',
		hasValidValue: boolean
	) =>
		Boolean(touchedFields[fieldName] || dirtyFields[fieldName]) &&
		!errors[fieldName] &&
		hasValidValue;
	const isTitleValid = isRequiredFieldValid('title', articleSubmissionSchema.shape.title.safeParse(watchedTitle).success);
	const isAbstractValid = isRequiredFieldValid('abstract', articleSubmissionSchema.shape.abstract.safeParse(watchedAbstract).success);
	const isKeywordsValid = isRequiredFieldValid('keywords', articleSubmissionSchema.shape.keywords.safeParse(watchedKeywords).success);
	const isTopicLineValid = isRequiredFieldValid('topicLine', articleSubmissionSchema.shape.topicLine.safeParse(watchedTopicLine).success);
	const isPdfValid = Boolean(pdfFile) && !pdfError;
	const completedRequiredFields = [
		isTitleValid,
		isAbstractValid,
		isKeywordsValid,
		isTopicLineValid,
		isPdfValid,
	].filter(Boolean).length;
	const progressPercentage = Math.round((completedRequiredFields / 5) * 100);

	useEffect(() => {
		const scrollElement = formScrollRef.current;
		if (!scrollElement) return;

		const updateScrollHint = () => {
			setHasMoreFormContent(
				scrollElement.scrollTop + scrollElement.clientHeight < scrollElement.scrollHeight - 1
			);
		};
		const routeWheelToForm = (event: WheelEvent) => {
			if (isSuccess || scrollElement.contains(event.target as Node) || event.deltaY === 0) return;

			const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
			const canScrollDown = event.deltaY > 0 && scrollElement.scrollTop < maxScrollTop;
			const canScrollUp = event.deltaY < 0 && scrollElement.scrollTop > 0;
			if (!canScrollDown && !canScrollUp) return;

			scrollElement.scrollTop += event.deltaY;
			event.preventDefault();
		};

		updateScrollHint();
		scrollElement.addEventListener('scroll', updateScrollHint, { passive: true });
		window.addEventListener('resize', updateScrollHint);
		window.addEventListener('wheel', routeWheelToForm, { passive: false });

		const resizeObserver = new ResizeObserver(updateScrollHint);
		resizeObserver.observe(scrollElement);
		const formElement = scrollElement.querySelector('form');
		if (formElement) resizeObserver.observe(formElement);

		return () => {
			scrollElement.removeEventListener('scroll', updateScrollHint);
			window.removeEventListener('resize', updateScrollHint);
			window.removeEventListener('wheel', routeWheelToForm);
			resizeObserver.disconnect();
		};
	}, [isSuccess]);

	useEffect(() => {
		if (!isSuccess) {
			if (successDialogWasOpen.current) {
				submitButtonRef.current?.focus();
				successDialogWasOpen.current = false;
			}
			return;
		}

		successDialogWasOpen.current = true;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		successCloseButtonRef.current?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [isSuccess]);

	const closeSuccessDialog = () => {
		reset();
		setPdfFile(null);
		setPdfError(null);
		setSubmissionError(null);
		setConfirmedCoauthors(new Set());
		setIsDragging(false);
		setIsSuccess(false);
		if (fileInputRef.current) fileInputRef.current.value = '';
		formScrollRef.current?.scrollTo({ top: 0 });
	};

	const handleSuccessDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeSuccessDialog();
			return;
		}

		if (event.key !== 'Tab') return;

		const focusableElements = successDialogRef.current?.querySelectorAll<HTMLElement>(
			'button:not(:disabled)'
		);
		if (!focusableElements?.length) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];
		if (event.shiftKey && document.activeElement === firstElement) {
			event.preventDefault();
			lastElement.focus();
		} else if (!event.shiftKey && document.activeElement === lastElement) {
			event.preventDefault();
			firstElement.focus();
		}
	};

	const confirmCoauthor = async (fieldId: string, index: number) => {
		const isValid = await trigger([
			`coauthors.${index}.name`,
			`coauthors.${index}.email`,
			`coauthors.${index}.affiliation`,
		]);

		if (isValid) {
			setConfirmedCoauthors((current) => new Set(current).add(fieldId));
		}
	};

	const editCoauthor = (fieldId: string) => {
		setConfirmedCoauthors((current) => {
			const next = new Set(current);
			next.delete(fieldId);
			return next;
		});
	};

	const removeCoauthor = (fieldId: string, index: number) => {
		remove(index);
		editCoauthor(fieldId);
	};

	const validateAndSetFile = (file: File | undefined) => {
		if (!file) return;

		const hasPdfType = file.type === 'application/pdf';
		const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');

		if (!hasPdfType && !hasPdfExtension) {
			setPdfFile(null);
			setPdfError('El archivo debe ser un documento PDF.');
			return;
		}

		if (file.size > MAX_PDF_SIZE) {
			setPdfFile(null);
			setPdfError('El archivo supera el tamaño máximo de 10 MB.');
			return;
		}

		setPdfFile(file);
		setPdfError(null);
		setIsSuccess(false);
	};

	const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
		validateAndSetFile(event.target.files?.[0]);
		event.target.value = '';
	};

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragging(false);
		validateAndSetFile(event.dataTransfer.files[0]);
	};

	const removePdf = () => {
		setPdfFile(null);
		setPdfError(null);
	};

	const onSubmit = async (data: ArticleSubmissionValues) => {
		setIsSuccess(false);
		setSubmissionError(null);
		if (hasUnconfirmedCoauthors) return;

		if (!pdfFile) {
			setPdfError('Adjunta el archivo PDF del artículo.');
			return;
		}

		const formData = new FormData();
		formData.append('title', data.title);
		formData.append('abstract', data.abstract);
		formData.append('keywords', data.keywords);
		formData.append('thematic_line', data.topicLine);
		formData.append('coauthors', JSON.stringify(data.coauthors.map(({ name, ...coauthor }) => ({ ...coauthor, full_name: name }))));
		formData.append('pdf', pdfFile);

		try {
			await apiClient.post('/articles/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
			setIsSuccess(true);
		} catch (error: unknown) {
			setSubmissionError(getArticleApiErrorMessage(error));
		}
	};

	const inputClassName = (hasError: boolean, isValid = false) =>
		`w-full min-w-0 rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 ${
			hasError
				? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
				: isValid
					? 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/15'
				: 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
		}`;

	return (
		<main className="article-submission relative isolate flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#f2f4f5] lg:h-[100dvh] lg:flex-row">
			<div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
				<span className="absolute -left-72 top-[8%] h-[36rem] w-[36rem] rounded-full bg-blue-950" />
				<span className="absolute left-[38%] top-[28%] h-72 w-72 rounded-full bg-indigo-200" />
				<span className="absolute -right-48 bottom-[-9rem] h-[34rem] w-[34rem] rounded-full bg-slate-200" />
			</div>

			<section className="article-submission-panel relative z-10 order-1 h-[100dvh] w-full min-w-0 p-3 sm:p-5 lg:min-h-0 lg:w-7/12 lg:p-6 2xl:w-6/12 2xl:p-8">
				<div className="relative mx-auto h-full min-h-0 w-full max-w-3xl">
					<div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white/95 text-left">
					<header className="article-submission-header relative z-20 shrink-0 border-b border-slate-200 bg-white px-5 py-5 sm:px-7 sm:py-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="min-w-0">
								<button
									type="button"
									onClick={onBackToMenu}
									disabled={isSubmitting || isSuccess}
									className="mb-3 -ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
								>
									<ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
									Artículos y Postulaciones
								</button>
								<h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Postular artículo</h1>
								<p className="mt-1 text-sm text-slate-500">
									Completa los metadatos y adjunta la versión inicial en PDF.
								</p>
							</div>
							<div className="w-full shrink-0 sm:w-44 sm:pt-1">
								<div className="mb-1 flex items-center justify-between gap-3 text-xs">
									<span className="font-medium text-slate-500">Progreso</span>
									<span className="font-semibold text-indigo-700">{completedRequiredFields} / 5 · {progressPercentage}%</span>
								</div>
								<div
									role="progressbar"
									aria-label="Progreso del formulario"
									aria-valuemin={0}
									aria-valuemax={5}
									aria-valuenow={completedRequiredFields}
									className="h-1.5 overflow-hidden rounded-full bg-indigo-100"
								>
									<div
										className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
										style={{ width: `${progressPercentage}%` }}
									/>
								</div>
							</div>
						</div>
					</header>

					<div ref={formScrollRef} className="article-form-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-7 sm:pb-7">
					<form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
						<div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
							<div className="min-w-0">
								<label htmlFor="article-title" className="mb-1.5 block text-sm font-medium text-slate-700">
									Título del artículo <span className="text-red-600">*</span>
								</label>
								<div className="relative">
								<input
									id="article-title"
									{...register('title')}
									aria-invalid={Boolean(errors.title)}
									aria-describedby={errors.title ? 'article-title-error' : undefined}
									placeholder="Escribe el título completo"
										className={`${inputClassName(Boolean(errors.title), isTitleValid)} ${isTitleValid ? 'pr-10' : ''}`}
								/>
								{isTitleValid && (
									<CheckCircle2 aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
								)}
								</div>
								{errors.title?.message && (
									<p id="article-title-error" role="alert" className="mt-1 text-xs text-red-600">
										{errors.title.message}
									</p>
								)}
							</div>

							<div className="min-w-0 md:col-span-2">
								<label htmlFor="article-abstract" className="mb-1.5 block text-sm font-medium text-slate-700">
									Resumen <span className="text-red-600">*</span>
								</label>
								<div className="relative">
								<textarea
									id="article-abstract"
									rows={5}
									{...register('abstract')}
									aria-invalid={Boolean(errors.abstract)}
									aria-describedby={errors.abstract ? 'article-abstract-error' : undefined}
									placeholder="Describe el propósito, método y resultados principales"
									className={`${inputClassName(Boolean(errors.abstract), isAbstractValid)} ${isAbstractValid ? 'pr-10' : ''} resize-y`}
								/>
								{isAbstractValid && (
									<CheckCircle2 aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-green-500" />
								)}
								</div>
								{errors.abstract?.message && (
									<p id="article-abstract-error" role="alert" className="mt-1 text-xs text-red-600">
										{errors.abstract.message}
									</p>
								)}
							</div>

							<div className="min-w-0">
								<label htmlFor="article-keywords" className="mb-1.5 block text-sm font-medium text-slate-700">
									Palabras clave <span className="text-red-600">*</span>
								</label>
								<div className="relative">
								<input
									id="article-keywords"
									{...register('keywords')}
									aria-invalid={Boolean(errors.keywords)}
									aria-describedby={errors.keywords ? 'article-keywords-error' : 'article-keywords-hint'}
									placeholder="Ej. inteligencia artificial, aprendizaje, datos"
									className={`${inputClassName(Boolean(errors.keywords), isKeywordsValid)} ${isKeywordsValid ? 'pr-10' : ''}`}
								/>
								{isKeywordsValid && (
									<CheckCircle2 aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
								)}
								</div>
								<p id="article-keywords-hint" className="mt-1 text-xs text-slate-500">
									Separa las palabras clave con comas.
								</p>
								{errors.keywords?.message && (
									<p id="article-keywords-error" role="alert" className="mt-1 text-xs text-red-600">
										{errors.keywords.message}
									</p>
								)}
							</div>

							<div className="min-w-0">
								<label htmlFor="article-topic-line" className="mb-1.5 block text-sm font-medium text-slate-700">
									Línea temática <span className="text-red-600">*</span>
								</label>
								<div className="relative">
								<select
									id="article-topic-line"
									{...register('topicLine')}
									aria-invalid={Boolean(errors.topicLine)}
									aria-describedby={errors.topicLine ? 'article-topic-line-error' : undefined}
									className={`${inputClassName(Boolean(errors.topicLine), isTopicLineValid)} ${isTopicLineValid ? 'pr-10' : ''}`}
									defaultValue="" disabled={!thematicLines.length || isSubmitting}
								>
									<option value="" disabled>Selecciona una línea temática</option>
									{thematicLines.map((topicLine) => (
										<option key={topicLine.id} value={String(topicLine.id)}>{topicLine.name}</option>
									))}
								</select>
									{isTopicLineValid && (
										<CheckCircle2 aria-hidden="true" className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
									)}
									</div>
								{errors.topicLine?.message && (
									<p id="article-topic-line-error" role="alert" className="mt-1 text-xs text-red-600">
										{errors.topicLine.message}
									</p>
								)}
							</div>
						</div>

						<section aria-labelledby="coauthors-heading" className="min-w-0 border-t border-slate-200 pt-6">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 id="coauthors-heading" className="text-base font-semibold text-slate-900">Coautores</h2>
									<p className="mt-0.5 text-xs text-slate-500">No necesitan tener una cuenta en el sistema.</p>
								</div>
								<button
									type="button"
									onClick={() => append({ name: '', affiliation: '', email: '' })}
									disabled={hasUnconfirmedCoauthors}
									aria-describedby={hasUnconfirmedCoauthors ? 'coauthors-add-hint' : undefined}
									className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Plus aria-hidden="true" className="h-4 w-4" />
									Agregar
								</button>
							</div>
							{hasUnconfirmedCoauthors && (
								<p id="coauthors-add-hint" role="status" className="-mt-2 mb-3 text-xs text-amber-700">
									Confirma o elimina la fila en edición para agregar otro coautor.
								</p>
							)}

							<div role="table" aria-label="Coautores del artículo" className="w-full rounded-lg border border-slate-200">
								<div role="rowgroup" className="hidden bg-slate-50 sm:block">
									<div role="row" className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
										<div role="columnheader" className="text-xs font-semibold text-slate-600">Nombre completo</div>
										<div role="columnheader" className="text-xs font-semibold text-slate-600">Correo electrónico</div>
										<div role="columnheader" className="text-xs font-semibold text-slate-600">Afiliación</div>
										<div role="columnheader" aria-label="Acciones" />
									</div>
								</div>
								<div role="rowgroup" className="divide-y divide-slate-100 bg-white">
									{fields.length === 0 ? (
										<div role="row" className="px-3 py-6 text-center text-sm text-slate-500">
											<div role="cell">No se han agregado coautores.</div>
										</div>
									) : (
										fields.map((field, index) => {
											const coauthorErrors = errors.coauthors?.[index];
											const isConfirmed = confirmedCoauthors.has(field.id);
											return (
											<div role="row" key={field.id} className="grid min-w-0 grid-cols-1 gap-3 p-3 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-start sm:gap-3 sm:py-3">
													<div role="cell" className="min-w-0">
														<label htmlFor={`coauthors-${index}-name`} className="mb-1.5 block text-xs font-medium text-slate-500 sm:sr-only">Nombre completo</label>
														<input
															id={`coauthors-${index}-name`}
															{...register(`coauthors.${index}.name`)}
															readOnly={isConfirmed}
															aria-invalid={Boolean(coauthorErrors?.name)}
															aria-describedby={coauthorErrors?.name ? `coauthors-${index}-name-error` : undefined}
															placeholder="Nombre completo"
															className={`${inputClassName(Boolean(coauthorErrors?.name))} ${isConfirmed ? 'bg-slate-50 text-slate-600' : ''}`}
														/>
														{coauthorErrors?.name?.message && (
															<p id={`coauthors-${index}-name-error`} role="alert" className="mt-1 text-xs text-red-600">{coauthorErrors.name.message}</p>
														)}
													</div>
													<div role="cell" className="min-w-0">
														<label htmlFor={`coauthors-${index}-email`} className="mb-1.5 block text-xs font-medium text-slate-500 sm:sr-only">Correo electrónico</label>
														<input
															id={`coauthors-${index}-email`}
															type="email"
															{...register(`coauthors.${index}.email`)}
															readOnly={isConfirmed}
															aria-invalid={Boolean(coauthorErrors?.email)}
															aria-describedby={coauthorErrors?.email ? `coauthors-${index}-email-error` : undefined}
															placeholder="correo@ejemplo.com"
															className={`${inputClassName(Boolean(coauthorErrors?.email))} ${isConfirmed ? 'bg-slate-50 text-slate-600' : ''}`}
														/>
														{coauthorErrors?.email?.message && (
															<p id={`coauthors-${index}-email-error`} role="alert" className="mt-1 text-xs text-red-600">{coauthorErrors.email.message}</p>
														)}
													</div>
													<div role="cell" className="min-w-0">
														<label htmlFor={`coauthors-${index}-affiliation`} className="mb-1.5 block text-xs font-medium text-slate-500 sm:sr-only">Afiliación</label>
														<input
															id={`coauthors-${index}-affiliation`}
															{...register(`coauthors.${index}.affiliation`)}
															readOnly={isConfirmed}
															aria-invalid={Boolean(coauthorErrors?.affiliation)}
															aria-describedby={coauthorErrors?.affiliation ? `coauthors-${index}-affiliation-error` : undefined}
															placeholder="Universidad o institución"
															className={`${inputClassName(Boolean(coauthorErrors?.affiliation))} ${isConfirmed ? 'bg-slate-50 text-slate-600' : ''}`}
														/>
														{coauthorErrors?.affiliation?.message && (
															<p id={`coauthors-${index}-affiliation-error`} role="alert" className="mt-1 text-xs text-red-600">{coauthorErrors.affiliation.message}</p>
														)}
													</div>
													<div role="cell" className="flex items-start justify-end gap-1 sm:pt-0.5">
														{isConfirmed ? (
															<>
																<span aria-label={`Coautor ${index + 1} confirmado`} title="Coautor confirmado" className="inline-flex h-9 w-9 items-center justify-center text-slate-700">
																<CheckCircle2 aria-hidden="true" className="h-4 w-4" />
															</span>
																<button
																type="button"
																onClick={() => editCoauthor(field.id)}
																disabled={hasUnconfirmedCoauthors}
																aria-label={`Editar coautor ${index + 1}`}
																title={`Editar coautor ${index + 1}`}
																className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
															>
																	<Pencil aria-hidden="true" className="h-4 w-4" />
																</button>
															</>
														) : (
															<button
																type="button"
																onClick={() => void confirmCoauthor(field.id, index)}
																aria-label={`Confirmar coautor ${index + 1}`}
																title="Confirmar coautor"
																className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-indigo-600 text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
															>
																<Check aria-hidden="true" className="h-4 w-4" />
															</button>
														)}
														<button
															type="button"
															onClick={() => removeCoauthor(field.id, index)}
															aria-label={`Eliminar coautor ${index + 1}`}
															title={`Eliminar coautor ${index + 1}`}
															className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
														>
															<Trash2 aria-hidden="true" className="h-4 w-4" />
														</button>
													</div>
												</div>
										);
									})
								)}
								</div>
							</div>
						</section>

						<section aria-labelledby="pdf-heading" className="min-w-0 border-t border-slate-200 pt-6">
							<h2 id="pdf-heading" className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
								Archivo del artículo <span className="text-red-600">*</span>
								{isPdfValid && <CheckCircle2 aria-label="Archivo PDF válido" className="h-4 w-4 text-green-500" />}
							</h2>
							<p className="mb-3 text-xs text-slate-500">Solo PDF · Tamaño máximo: 10 MB</p>

							{!pdfFile ? (
								<div
									onDragOver={(event) => {
										event.preventDefault();
										setIsDragging(true);
									}}
									onDragLeave={() => setIsDragging(false)}
									onDrop={handleDrop}
									className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
									pdfError ? 'border-red-400 bg-red-50/30' : isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-slate-50/60'
									}`}
								>
									<input
										ref={fileInputRef}
										id="article-pdf"
										type="file"
										accept="application/pdf,.pdf"
										onChange={handleFileInput}
										className="sr-only"
										aria-describedby={pdfError ? 'article-pdf-error' : undefined}
									/>
									<Upload aria-hidden="true" className="mx-auto h-7 w-7 text-slate-400" />
									<p className="mt-2 text-sm font-medium text-slate-700">Arrastra el PDF aquí</p>
									<p className="mt-1 text-xs text-slate-500">o selecciónalo desde tu dispositivo</p>
									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
									>
										<FileUp aria-hidden="true" className="h-4 w-4" />
										Seleccionar PDF
									</button>
								</div>
							) : (
								<div className="flex min-w-0 items-center gap-3 border-y border-emerald-200 py-3">
									<FileText aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-700" />
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-slate-800">{pdfFile.name}</p>
										<p className="text-xs text-slate-500">{formatFileSize(pdfFile.size)} MB</p>
									</div>
									<button
										type="button"
										onClick={removePdf}
										aria-label="Quitar archivo PDF"
										className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
									>
										<X aria-hidden="true" className="h-4 w-4" />
									</button>
								</div>
							)}
							{pdfError && (
								<p id="article-pdf-error" role="alert" className="mt-2 text-xs text-red-600">
									{pdfError}
								</p>
							)}
						</section>

						{topicsError && <p role="alert" className="text-sm text-red-600">{topicsError}</p>}
						{submissionError && <p role="alert" className="text-sm text-red-600">{submissionError}</p>}
						<div className="flex justify-end border-t border-slate-200 pt-5">
							<button
								ref={submitButtonRef}
								type="submit"
								disabled={isSubmitting || isSuccess || !thematicLines.length || hasUnconfirmedCoauthors}
										className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isSubmitting ? 'Procesando…' : 'Enviar artículo'}
							</button>
						</div>
					</form>
					</div>
				</div>
					{hasMoreFormContent && (
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 rounded-b-3xl bg-gradient-to-t from-indigo-600/20 via-indigo-500/5 to-transparent"
						/>
					)}
				</div>
			</section>

			<aside className="article-submission-visual relative z-10 order-2 flex min-h-[44dvh] w-full min-w-0 flex-col items-center justify-center px-4 py-6 lg:min-h-0 lg:w-5/12 lg:px-6 lg:py-6 2xl:w-6/12">
				<div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
					<img
						src={publishArticleAnimation}
						alt=""
						className="mb-2 max-h-[42dvh] w-64 max-w-full object-contain sm:w-80 lg:mb-4 lg:w-[90%] lg:max-w-2xl"
					/>
					<div className="visual-panel-copy min-w-0 max-w-2xl">
						<p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
							GCDC · Conferencia
						</p>
						<h2 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl 2xl:text-5xl">
							Gestión Científica de Conferencia
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-700 sm:text-base lg:text-lg">
							Envía tu propuesta académica a las 5 Líneas Temáticas Oficiales.
						</p>
					</div>
				</div>
			</aside>

			{isSuccess && (
				<div
					className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) closeSuccessDialog();
					}}
				>
					<div
						ref={successDialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="article-success-title"
						aria-describedby="article-success-description"
						onKeyDown={handleSuccessDialogKeyDown}
						className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
					>
						<div className="flex items-start gap-4">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
								<CheckCircle2 aria-hidden="true" className="h-6 w-6" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Postulación</p>
								<h2 id="article-success-title" className="mt-1 text-xl font-semibold text-slate-900">
									Artículo postulado correctamente
								</h2>
							</div>
							<button
								ref={successCloseButtonRef}
								type="button"
								onClick={closeSuccessDialog}
								aria-label="Cerrar confirmación"
								className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
							>
								<X aria-hidden="true" className="h-4 w-4" />
							</button>
						</div>
						<p id="article-success-description" className="mt-4 text-sm leading-relaxed text-slate-600">
							Tu artículo se guardó correctamente. Puedes subir otro artículo o volver al menú de Artículos y Postulaciones.
						</p>
						<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
							<button type="button" onClick={onBackToMenu} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Volver a Artículos</button>
							<button
								type="button"
								onClick={closeSuccessDialog}
								className="inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
							>
								Subir otro artículo
							</button>
						</div>
					</div>
				</div>
			)}

		</main>
	);
};
