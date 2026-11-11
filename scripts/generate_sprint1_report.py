import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para calcular dinámicamente el número total de páginas."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        # Encabezado (páginas > 1)
        if self._pageNumber > 1:
            self.drawString(
                40,
                letter[1] - 30,
                "GCDC — Reporte de Infraestructura, Regla de Oro y Base de Datos (Sprint 1)",
            )
            self.drawRightString(
                letter[0] - 40,
                letter[1] - 30,
                "Universidad del Valle",
            )
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.5)
            self.line(40, letter[1] - 34, letter[0] - 40, letter[1] - 34)

        # Pie de página (todas las páginas)
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawString(
            40,
            24,
            "Confidencial — Uso Interno Proyecto GCDC / Escuela de Ingeniería de Sistemas",
        )
        self.drawRightString(letter[0] - 40, 24, page_text)
        self.setStrokeColor(colors.HexColor("#E2E8F0"))
        self.setLineWidth(0.5)
        self.line(40, 32, letter[0] - 40, 32)

        self.restoreState()


def build_pdf(filename="docs/REPORTE_INFRAESTRUCTURA_SPRINT1.pdf"):
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=45,
        bottomMargin=45,
    )

    styles = getSampleStyleSheet()

    # Colores temáticos
    UNIVALLE_RED = colors.HexColor("#990000")
    SYMPOSIA_INDIGO = colors.HexColor("#4338CA")
    TEXT_MAIN = colors.HexColor("#0F172A")
    TEXT_MUTED = colors.HexColor("#475569")
    BG_LIGHT = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")
    SUCCESS_COLOR = colors.HexColor("#059669")
    CODE_BG = colors.HexColor("#0F172A")
    CODE_TEXT = colors.HexColor("#F1F5F9")

    # Estilos tipográficos
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=UNIVALLE_RED,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=14,
        textColor=SYMPOSIA_INDIGO,
        spaceAfter=12,
    )
    h1_style = ParagraphStyle(
        "SectionH1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=SYMPOSIA_INDIGO,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=UNIVALLE_RED,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12.5,
        textColor=TEXT_MAIN,
        spaceAfter=6,
    )
    body_bold = ParagraphStyle(
        "BodyDarkBold",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    code_block = ParagraphStyle(
        "CodeBlock",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
        textColor=CODE_TEXT,
    )
    table_cell = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10.5,
        textColor=TEXT_MAIN,
    )
    table_cell_bold = ParagraphStyle(
        "TableCellBold",
        parent=table_cell,
        fontName="Helvetica-Bold",
        textColor=TEXT_MAIN,
    )
    table_cell_code = ParagraphStyle(
        "TableCellCode",
        parent=table_cell,
        fontName="Courier",
        fontSize=7.5,
        leading=9.5,
    )

    story = []

    # 1. Cabecera y Metadatos
    story.append(Paragraph("Reporte Técnico de Infraestructura, Regla de Oro y Modelado de BD", title_style))
    story.append(Paragraph("Sistema de Gestión Científica de Conferencia (GCDC) — Universidad del Valle", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=UNIVALLE_RED, spaceAfter=8))

    meta_data = [
        [
            Paragraph("<b>Rama Git:</b>", table_cell_bold),
            Paragraph("<code>feature/sprint1-db-indexes-and-fields</code>", table_cell),
            Paragraph("<b>Fecha:</b>", table_cell_bold),
            Paragraph("10 de Noviembre de 2026", table_cell),
        ],
        [
            Paragraph("<b>Responsable:</b>", table_cell_bold),
            Paragraph("Braulio Robledo (Scrum Master / Full-Stack)", table_cell),
            Paragraph("<b>Estado PR:</b>", table_cell_bold),
            Paragraph("<font color='#059669'><b>Listo para Merge hacia main</b></font>", table_cell),
        ],
        [
            Paragraph("<b>Stack Backend:</b>", table_cell_bold),
            Paragraph("Django 5.1+, DRF, SimpleJWT, PostgreSQL 16", table_cell),
            Paragraph("<b>Stack Frontend:</b>", table_cell_bold),
            Paragraph("React 18, TypeScript, Tailwind CSS, Vite", table_cell),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[90, 180, 80, 182])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 2. Pilar 1: Regla de Oro
    story.append(Paragraph("1. Pilar I: Implementación de la \"Regla de Oro\" (Aislamiento de Git y Entornos)", h1_style))
    story.append(
        Paragraph(
            "Con un equipo de 7 desarrolladores concurrentes en el Sprint 1, el riesgo principal radicaba en "
            "conflictos binarios de Git y colisiones en archivos raíz. Se establecieron tres medidas de aislamiento:",
            body_style,
        )
    )

    p1_items = [
        [
            Paragraph("<b>A. Desindexación y Blindaje de DB Local</b>", table_cell_bold),
            Paragraph(
                "Se eliminó <code>backend/db.sqlite3</code> del índice de Git mediante <code>git rm --cached</code> "
                "y se blindó en <code>.gitignore</code> junto con <code>*.sqlite3</code>, <code>.env</code> y <code>__pycache__/</code>. "
                "Esto previene colisiones binarias destructivas entre entornos de desarrollo.",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>B. Pre-enrutamiento Modular en Backend</b>", table_cell_bold),
            Paragraph(
                "En <code>backend/config/urls.py</code> se definieron de forma anticipada los prefijos: "
                "<code>/api/v1/users/</code>, <code>/api/v1/conferences/</code>, <code>/api/v1/articles/</code> y "
                "<code>/api/v1/reviews/</code>. Cada aplicación gestiona sus URLs en su propio archivo sin tocar la raíz.",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>C. Dominio Modular en Frontend</b>", table_cell_bold),
            Paragraph(
                "Estructura desacoplada en <code>src/components/</code> (carpetas <code>users/</code>, <code>articles/</code>, <code>reviews/</code>). "
                "Se preservó <code>src/components/UserCreationForm.tsx</code> como re-export transparente para garantizar 100% de compatibilidad hacia atrás.",
                table_cell,
            ),
        ],
    ]
    p1_table = Table(p1_items, colWidths=[160, 372])
    p1_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("BACKGROUND", (0, 0), (0, -1), BG_LIGHT),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(p1_table)
    story.append(Spacer(1, 10))

    # 3. Pilar 2: Consolidación de Base de Datos
    story.append(Paragraph("2. Pilar II: Consolidación de las 6 Subtareas de Base de Datos (PostgreSQL / Django)", h1_style))
    story.append(
        Paragraph(
            "Se implementaron y validaron las 6 especificaciones técnicas de base de datos asignadas al Sprint 1:",
            body_style,
        )
    )

    db_tasks_data = [
        [
            Paragraph("<b>Jira ID</b>", table_cell_bold),
            Paragraph("<b>HU Padre</b>", table_cell_bold),
            Paragraph("<b>Modelo / Tabla</b>", table_cell_bold),
            Paragraph("<b>Especificación Técnica y Código Implementado</b>", table_cell_bold),
        ],
        [
            Paragraph("<b>GCDC-134</b>", table_cell_bold),
            Paragraph("HU-05 (Perfil)", table_cell),
            Paragraph("<code>CustomUser</code><br/>(tabla: <code>usuario</code>)", table_cell),
            Paragraph(
                "• <code>affiliation = CharField(max_length=255, blank=True)</code><br/>"
                "• <code>bio = TextField(null=True, blank=True)</code><br/>"
                "• <code>updated_at = DateTimeField(auto_now=True)</code>",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>GCDC-138</b>", table_cell_bold),
            Paragraph("HU-06 (Baja lógica)", table_cell),
            Paragraph("<code>CustomUser</code><br/>(tabla: <code>usuario</code>)", table_cell),
            Paragraph(
                "• Campo <code>deleted_at = DateTimeField(null=True, blank=True)</code><br/>"
                "• Método <code>soft_delete(self)</code> asignando <code>is_active=False</code><br/>"
                "• <code>objects = ActiveUserManager()</code> y <code>all_objects = CustomUserManager()</code>",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>GCDC-130</b>", table_cell_bold),
            Paragraph("HU-04 (Búsqueda)", table_cell),
            Paragraph("<code>CustomUser</code> &amp;<br/><code>UserRole</code>", table_cell),
            Paragraph(
                "• Índices B-Tree en <code>CustomUser.Meta</code>:<br/>"
                "  - <code>idx_user_email</code> sobre <code>['email']</code><br/>"
                "  - <code>idx_user_affiliation</code> sobre <code>['affiliation']</code><br/>"
                "  - <code>idx_user_active_email</code> sobre <code>['is_active', 'email']</code><br/>"
                "• Índice compuesto en <code>UserRole.Meta</code>: <code>idx_user_role_user_role</code>",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>GCDC-154</b>", table_cell_bold),
            Paragraph("HU-10 (Deshabilitación)", table_cell),
            Paragraph("<code>Article</code><br/>(tabla: <code>articulo</code>)", table_cell),
            Paragraph(
                "• Estado <code>ArticleStatus.DESHABILITADO</code> en <code>TextChoices</code><br/>"
                "• <code>is_enabled = BooleanField(default=True, db_index=True)</code><br/>"
                "• <code>disabled_reason = TextField(null=True, blank=True)</code><br/>"
                "• <code>disabled_at = DateTimeField(null=True, blank=True)</code><br/>"
                "• <code>is_permanently_disabled = BooleanField(default=False)</code>",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>GCDC-146</b>", table_cell_bold),
            Paragraph("HU-08 (Filtros Art.)", table_cell),
            Paragraph("<code>Article</code><br/>(tabla: <code>articulo</code>)", table_cell),
            Paragraph(
                "• Índice compuesto Catálogo/Comité:<br/>"
                "  <code>idx_art_enabled_topic_status</code> sobre <code>['is_enabled', 'thematic_line', 'status']</code><br/>"
                "• Índice compuesto Vista Autor:<br/>"
                "  <code>idx_art_author_enabled</code> sobre <code>['responsible_author', 'is_enabled']</code>",
                table_cell,
            ),
        ],
        [
            Paragraph("<b>GCDC-150</b>", table_cell_bold),
            Paragraph("HU-09 (Metadatos)", table_cell),
            Paragraph("<code>ArticleMetadataAudit</code><br/>(<code>auditoria_metadatos_articulo</code>)", table_cell),
            Paragraph(
                "• Modelo de histórico con <code>field_name</code>, <code>old_value</code>, <code>new_value</code>, <code>modified_at</code><br/>"
                "• Trigger automático vía señal <code>pre_save</code> en <code>Article</code> auditando cambios en <code>title</code> y <code>abstract</code>",
                table_cell,
            ),
        ],
    ]

    db_table = Table(db_tasks_data, colWidths=[65, 80, 110, 277])
    db_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SYMPOSIA_INDIGO),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    # Highlight header labels
    for i in range(4):
        db_tasks_data[0][i].style.textColor = colors.white
    story.append(db_table)
    story.append(Spacer(1, 10))

    # 4. Pilar 3: Control de Migraciones
    story.append(Paragraph("3. Pilar III: Control de Migraciones y Prevención de Inconsistencias", h1_style))
    story.append(
        Paragraph(
            "Se garantizó un árbol lineal de dependencias sin bifurcaciones, eliminando riesgos de "
            "<code>InconsistentMigrationHistory</code> o discrepancias de llaves foráneas:",
            body_style,
        )
    )

    mig_data = [
        [
            Paragraph("<b>Aplicación</b>", table_cell_bold),
            Paragraph("<b>Archivo de Migración Generado</b>", table_cell_bold),
            Paragraph("<b>Operaciones Clave en Base de Datos</b>", table_cell_bold),
        ],
        [
            Paragraph("<code>users</code>", table_cell),
            Paragraph("<code>0005_customuser_bio_alter_customuser_affiliation.py</code>", table_cell_code),
            Paragraph("Adición de <code>bio</code> y <code>updated_at</code>; flexibilización de <code>affiliation</code>", table_cell),
        ],
        [
            Paragraph("<code>users</code>", table_cell),
            Paragraph("<code>0006_alter_customuser_managers.py</code>", table_cell_code),
            Paragraph("Registro formal de <code>ActiveUserManager</code> como manager por defecto", table_cell),
        ],
        [
            Paragraph("<code>users</code>", table_cell),
            Paragraph("<code>0007_remove_customuser_custom_user_active_idx_and_more.py</code>", table_cell_code),
            Paragraph("Creación de índices B-Tree en <code>CustomUser</code> e índice en <code>UserRole</code>", table_cell),
        ],
        [
            Paragraph("<code>conferences</code>", table_cell),
            Paragraph("<code>0005_article_disabled_at_article_disabled_reason_and_more.py</code>", table_cell_code),
            Paragraph("Adición de campos de deshabilitación y opción <code>DESHABILITADO</code>", table_cell),
        ],
        [
            Paragraph("<code>conferences</code>", table_cell),
            Paragraph("<code>0006_article_idx_art_enabled_topic_status_and_more.py</code>", table_cell_code),
            Paragraph("Creación de índices compuestos <code>idx_art_enabled_topic_status</code> y <code>idx_art_author_enabled</code>", table_cell),
        ],
        [
            Paragraph("<code>conferences</code>", table_cell),
            Paragraph("<code>0007_articlemetadataaudit.py</code>", table_cell_code),
            Paragraph("Creación del modelo y tabla <code>auditoria_metadatos_articulo</code>", table_cell),
        ],
    ]
    mig_table = Table(mig_data, colWidths=[75, 235, 222])
    mig_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), BG_LIGHT),
                ("BOX", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, BORDER_COLOR),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 3.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(mig_table)
    story.append(Spacer(1, 10))

    # 5. Pilar 4: Resultados de Pruebas Unitarias
    story.append(Paragraph("4. Pilar IV: Resultados de Pruebas Unitarias y Verificación Final", h1_style))
    story.append(
        Paragraph(
            "Se ejecutó la suite de pruebas unitarias cubriendo ambas aplicaciones de forma exhaustiva:",
            body_style,
        )
    )

    test_box_data = [
        [
            Paragraph("<b>Comando Ejecutado:</b>", table_cell_bold),
            Paragraph("<code>python backend/manage.py test apps.users apps.conferences</code>", table_cell_code),
        ],
        [
            Paragraph("<b>Total Pruebas:</b>", table_cell_bold),
            Paragraph("<b>15 pruebas unitarias</b> (todas aprobadas)", table_cell),
        ],
        [
            Paragraph("<b>Tasa de Éxito:</b>", table_cell_bold),
            Paragraph("<font color='#059669'><b>100% OK (0 fallos, 0 errores, 0 silenciados)</b></font>", table_cell),
        ],
        [
            Paragraph("<b>Validaciones Críticas:</b>", table_cell_bold),
            Paragraph(
                "• Registro y creación RBAC (contraseñas con hash PBKDF2-SHA256, unicidad de correo institucional).<br/>"
                "• Soft-Delete (exclusión automática en <code>objects</code> y persistencia en <code>all_objects</code>).<br/>"
                "• Existencia e integridad de índices B-Tree en metadatos de modelos.<br/>"
                "• Deshabilitación y auditoría de metadatos (<code>title</code> y <code>abstract</code>) mediante trigger <code>pre_save</code>.",
                table_cell,
            ),
        ],
    ]
    test_box = Table(test_box_data, colWidths=[120, 412])
    test_box.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 1, SUCCESS_COLOR),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BBF7D0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(test_box)
    story.append(Spacer(1, 10))

    # 6. Estado de Git y Conclusión
    story.append(Paragraph("5. Estado de Git y Recomendación para Merge", h1_style))
    story.append(
        Paragraph(
            "El repositorio cuenta con todos los cambios listos para commit en la rama "
            "<code>feature/sprint1-db-indexes-and-fields</code>. No existen dependencias circulares, "
            "y los archivos binarios locales continúan desvinculados del control de versiones. "
            "Se aprueba el paso hacia Pull Request e integración continua en <code>main</code>.",
            body_style,
        )
    )

    doc.build(story, canvasmaker=NumberedCanvas)
    return filename


if __name__ == "__main__":
    out_pdf = build_pdf()
    size_bytes = os.path.getsize(out_pdf)
    print(f"PDF generado exitosamente en: {out_pdf}")
    print(f"Tamaño: {size_bytes} bytes ({size_bytes / 1024:.2f} KB)")
