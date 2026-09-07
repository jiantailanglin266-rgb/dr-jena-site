/**
 * Demo job generator — 100 fictional jobs across 9 countries and 10 categories.
 * Deterministic (seeded) so the seed and the Fake Marketplace API return identical data.
 */
import type { NormalizedJob } from "../connectors/types";
import { normalizeJob } from "../connectors/base";
import { hashString } from "../utils";

export const DEMO_COUNTRIES = [
  { code: "JP", lang: "ja", currency: "JPY", tz: "Asia/Tokyo" },
  { code: "US", lang: "en", currency: "USD", tz: "America/New_York" },
  { code: "GB", lang: "en", currency: "GBP", tz: "Europe/London" },
  { code: "DE", lang: "de", currency: "EUR", tz: "Europe/Berlin" },
  { code: "FR", lang: "fr", currency: "EUR", tz: "Europe/Paris" },
  { code: "ES", lang: "es", currency: "EUR", tz: "Europe/Madrid" },
  { code: "SG", lang: "en", currency: "SGD", tz: "Asia/Singapore" },
  { code: "AU", lang: "en", currency: "AUD", tz: "Australia/Sydney" },
  { code: "KR", lang: "ko", currency: "KRW", tz: "Asia/Seoul" },
] as const;

export const DEMO_CATEGORIES = ["Web Development", "SaaS", "AI", "Marketing", "Design", "Video", "EC", "SEO", "Automation", "Consulting"] as const;

/** [client name, industry] pairs per country — kept coherent so the client matches the brief. */
const CLIENTS: Record<string, [string, string][]> = {
  JP: [["株式会社ミライ商事", "食品商社"], ["北斗フーズ株式会社", "食品メーカー"], ["青葉クリニック", "歯科クリニック"], ["株式会社カナデ不動産", "不動産会社"], ["湘南ビューティーラボ", "美容サロン"], ["株式会社テクノブリッジ", "ITサービス企業"], ["ゆず製菓", "製菓ブランド"], ["京都おもてなし旅館", "旅館"], ["大阪ロジスティクス", "物流会社"], ["さくら学習塾", "教育サービス"]],
  US: [["Brightline Dental Group", "dental clinic"], ["Harbor & Pine Coffee", "specialty coffee brand"], ["Northwind Analytics", "B2B analytics startup"], ["Cedar Ridge Realty", "real-estate agency"], ["Lumen Fitness", "fitness studio"], ["Atlas Outdoor Co.", "outdoor equipment retailer"], ["Summit Legal Partners", "law firm"], ["Quill Learning", "online tutoring service"], ["Redwood Home Services", "home services company"]],
  GB: [["Thistle & Oak Interiors", "interior design studio"], ["Marlow Financial Advisers", "financial advisory firm"], ["Greenway Cycles Ltd", "bicycle retailer"], ["Camden Bakehouse", "artisan bakery"], ["Kestrel Recruitment", "recruitment agency"], ["Albion Sports Academy", "sports academy"], ["Bristol Organic Box", "organic food delivery service"], ["Wren Architects", "architecture practice"]],
  DE: [["Müller & Sohn Maschinenbau GmbH", "Maschinenbauunternehmen"], ["Berliner Kaffeerösterei", "Kaffeerösterei"], ["Nordlicht Immobilien", "Immobilienbüro"], ["Schwarzwald Naturkosmetik", "Naturkosmetikmarke"], ["Rheinland Logistik AG", "Logistikunternehmen"], ["Alpenblick Hotels", "Hotelgruppe"], ["Hansa Medizintechnik", "Medizintechnik-Hersteller"], ["Fahrradwerk Leipzig", "Fahrradhersteller"]],
  FR: [["Maison Lavande Cosmétiques", "marque de cosmétiques"], ["Atelier Dubois Ébénisterie", "atelier d'ébénisterie"], ["Clinique Saint-Michel", "clinique dentaire"], ["Bistro Le Marais", "bistro"], ["Voyages Lumière", "agence de voyages"], ["Vignobles de Provence", "domaine viticole"], ["Studio Nova Architecture", "cabinet d'architecture"], ["Éditions Petit Prince", "maison d'édition"]],
  ES: [["Clínica Dental Sol", "clínica dental"], ["Bodegas Rioja Real", "bodega"], ["Academia Idiomas Madrid", "academia de idiomas"], ["Inmobiliaria Costa Azul", "inmobiliaria"], ["Cafés Barcelona", "tostador de café"], ["Moda Sevilla Boutique", "boutique de moda"], ["Gimnasio Vitalia", "gimnasio"], ["Turismo Andalucía Tours", "agencia de turismo"]],
  SG: [["Merlion Wealth Advisory", "wealth advisory firm"], ["Orchard Skin Clinic", "aesthetic clinic"], ["Straits Logistics Pte Ltd", "logistics company"], ["Tanjong Pagar Dental", "dental clinic"], ["Lion City Tutors", "tuition centre"], ["Marina Bay Events", "events agency"], ["Katong Bakery", "bakery"], ["Raffles Property Group", "property group"]],
  AU: [["Bondi Surf School", "surf school"], ["Outback Solar Solutions", "solar installer"], ["Melbourne Coffee Collective", "coffee roaster"], ["Perth Physio Clinic", "physiotherapy clinic"], ["Sunshine Coast Realty", "real-estate agency"], ["Harbourside Law", "law firm"], ["Kangaroo Kids Learning", "childcare provider"], ["Brisbane Wellness Studio", "wellness studio"]],
  KR: [["서울 스마트 클리닉", "치과"], ["한강 푸드컴퍼니", "식품회사"], ["부산 해양물류", "물류회사"], ["제주 감귤농장", "농장"], ["강남 뷰티랩", "뷰티 브랜드"], ["판교 테크스타트", "테크 스타트업"], ["인천 로지스", "물류 스타트업"], ["대구 패션하우스", "패션 브랜드"]],
};

interface Tpl { title: string; desc: string; skills: string[] }

/** Job templates per language × category. {industry} is interpolated. */
const TEMPLATES: Record<string, Record<string, Tpl[]>> = {
  ja: {
    "Web Development": [
      { title: "{industry}のコーポレートサイトリニューアル（レスポンシブ対応）", desc: "現在のサイトが古くスマホ表示が崩れているため、全面的にリニューアルしたいです。ページ数は約15ページ、お問い合わせフォーム、ブログ機能（自社で更新できるCMS）、Googleマップ埋め込みを希望します。デザインは清潔感のあるものを希望。ワイヤーフレームからお任せしたいです。納品後の軽微な修正にも対応いただける方を希望します。", skills: ["Next.js", "WordPress", "Responsive Design", "SEO"] },
      { title: "{industry}向け予約システム付きランディングページ制作", desc: "新サービスの集客用ランディングページを作成し、予約フォーム（日時選択・自動返信メール）を組み込みたいです。Google広告からの流入を想定しているためページ速度を重視します。原稿と写真はこちらで用意します。", skills: ["HTML/CSS", "JavaScript", "Landing Page", "Form Integration"] },
    ],
    SaaS: [{ title: "{industry}向け顧客管理SaaSのMVP開発", desc: "社内で使っているExcelの顧客管理をWebアプリ化し、将来的に同業他社へ販売したいと考えています。必要機能：ログイン、顧客一覧・詳細、対応履歴、簡単な分析ダッシュボード、CSVエクスポート。マルチテナント構成で設計してほしいです。技術選定はお任せしますが、保守しやすいものを希望します。", skills: ["Next.js", "PostgreSQL", "Prisma", "Multi-tenant", "TypeScript"] }],
    AI: [{ title: "問い合わせ対応AIチャットボット導入（{industry}）", desc: "自社サイトの問い合わせ対応をAIチャットボットで自動化したいです。FAQ（約80件）と営業時間・料金案内をもとに回答し、対応できない質問は担当者へメール転送する仕組みを希望します。Claude または OpenAI の利用を想定。回答ログを確認できる管理画面も欲しいです。", skills: ["LLM", "Claude API", "RAG", "Python", "Chatbot"] }],
    Marketing: [{ title: "{industry}のInstagram・LINE運用と広告運用代行", desc: "月額での運用代行を探しています。Instagram投稿（週3回）、LINE公式アカウントの配信設計、Meta広告の運用（月予算30万円）。毎月レポート提出をお願いします。美容・ヘルスケア領域の実績がある方を優先します。", skills: ["Instagram", "LINE", "Meta Ads", "Content Marketing"] }],
    Design: [{ title: "{industry}のブランドロゴとVI（ビジュアルアイデンティティ）制作", desc: "リブランディングに伴い、ロゴ・カラーパレット・タイポグラフィ・名刺・封筒のデザインをお願いします。提案は3案、修正は2回まで想定。AIデータ納品必須。高級感と親しみやすさの両立を希望します。", skills: ["Logo Design", "Branding", "Illustrator", "Typography"] }],
    Video: [{ title: "{industry}のブランドムービー制作（60秒・SNS用カット付き）", desc: "Webサイトのトップに掲載する60秒のブランドムービーと、Instagram用の15秒カット3本を制作してほしいです。撮影は東京都内1日、ナレーション・BGM込み。字幕（日英）も希望します。", skills: ["Video Editing", "Premiere Pro", "Motion Graphics", "Storyboard"] }],
    EC: [{ title: "{industry}のShopify ECサイト構築（約120商品）", desc: "実店舗の商品をオンライン販売するためShopifyでECサイトを構築したいです。商品登録（120点、データはCSVで用意）、決済（クレジット・コンビニ・PayPay）、配送設定、定期購入アプリの導入、簡単なデザインカスタマイズをお願いします。", skills: ["Shopify", "Liquid", "EC", "Payment Integration"] }],
    SEO: [{ title: "{industry}サイトのSEO改善（テクニカル＋コンテンツ）", desc: "検索順位が下がっており、原因分析と改善をお願いしたいです。サイト診断、内部対策（表示速度・構造化データ）、キーワード設計、記事構成案の作成（月8本）を希望。3ヶ月契約からスタートし、成果次第で継続します。", skills: ["SEO", "Google Search Console", "Content Strategy", "Technical SEO"] }],
    Automation: [{ title: "受注〜請求業務の自動化（{industry}・kintone/Slack連携）", desc: "注文メールの内容をkintoneに自動登録し、Slackに通知、月末に請求書PDFを自動生成する仕組みを作りたいです。Make / Zapier またはスクリプトどちらでも構いません。運用マニュアルの作成も含めてお願いします。", skills: ["Automation", "kintone", "Slack API", "Zapier", "Python"] }],
    Consulting: [{ title: "{industry}のDX戦略立案とロードマップ作成", desc: "業務のデジタル化を進めたいが、何から着手すべきか整理できていません。現状ヒアリング（3部門）、課題整理、優先順位付け、12ヶ月のロードマップ、経営層向け報告資料の作成をお願いします。週1回のオンライン会議を想定。", skills: ["DX", "Consulting", "Roadmap", "Business Analysis"] }],
  },
  en: {
    "Web Development": [
      { title: "Website redesign for a {industry} (Next.js or WordPress)", desc: "Our current site is 6 years old, slow, and not mobile friendly. We need a full redesign of ~12 pages with a blog we can update ourselves, appointment/contact forms, Google Maps and reviews integration. We care about Core Web Vitals and accessibility. Copy and photos will be provided. Please include a short maintenance period after launch.", skills: ["Next.js", "WordPress", "Tailwind CSS", "SEO", "Accessibility"] },
      { title: "High-converting landing page + booking flow for a {industry}", desc: "Looking for a developer to build a landing page for a new offer with an embedded booking flow (date picker, confirmation email, calendar sync). Traffic comes from paid ads, so page speed and A/B testing hooks matter. Figma design is ready.", skills: ["React", "Landing Page", "Calendly/API", "Performance"] },
    ],
    SaaS: [{ title: "MVP of a B2B SaaS for {industry} operations (multi-tenant)", desc: "We want to turn our internal spreadsheets into a web application that we can later sell to similar businesses. Must have: authentication, organisations/teams, customer records with history, simple analytics dashboard, CSV export, Stripe billing. Prefer TypeScript stack. We expect a 2-phase delivery: MVP, then polish.", skills: ["Next.js", "PostgreSQL", "Stripe", "Multi-tenant", "TypeScript"] }],
    AI: [{ title: "AI assistant for customer enquiries at a {industry}", desc: "We receive ~300 enquiries a month by email and web chat. We'd like an AI assistant that answers from our FAQ and pricing docs, escalates to a human when unsure, and logs every conversation to a dashboard. Open to Claude or OpenAI. Must handle English and Spanish.", skills: ["LLM", "RAG", "Claude API", "Python", "Chatbot"] }],
    Marketing: [{ title: "Paid social + email marketing management for a {industry}", desc: "Monthly retainer: Meta and Google Ads management (budget USD 5k/month), 2 email campaigns per month, monthly performance report with recommendations. Experience in local-service businesses preferred. 3-month initial term.", skills: ["Meta Ads", "Google Ads", "Email Marketing", "Analytics"] }],
    Design: [{ title: "Brand identity refresh for a {industry}", desc: "We need a refreshed logo, colour palette, typography, social templates and a one-page brand guideline. 3 initial concepts, 2 revision rounds. Deliver source files (AI/Figma). Our tone: premium but approachable.", skills: ["Branding", "Logo Design", "Figma", "Typography"] }],
    Video: [{ title: "60-second brand video + social cut-downs for a {industry}", desc: "One-day shoot at our location, script and storyboard support, professional editing, licensed music, captions. Deliver a 60s hero video for the website and three 15s vertical cuts for Instagram/TikTok.", skills: ["Video Production", "Editing", "Motion Graphics", "Storyboarding"] }],
    EC: [{ title: "Shopify store build with ~150 SKUs for a {industry}", desc: "Build an online store on Shopify: theme customisation, product import from CSV, payments (Stripe/PayPal), shipping rules, subscription app setup, basic SEO. Provide training for our staff.", skills: ["Shopify", "Liquid", "E-commerce", "Payment Integration"] }],
    SEO: [{ title: "Technical + content SEO for a {industry} website", desc: "Rankings dropped after a site migration. Need a full technical audit, fixes (speed, schema, internal links), keyword strategy and 8 briefed articles per month. Start with a 3-month engagement.", skills: ["SEO", "Technical SEO", "Content Strategy", "Search Console"] }],
    Automation: [{ title: "Order-to-invoice automation for a {industry} (HubSpot, Slack, Xero)", desc: "Automate: new order emails → CRM record → Slack alert → monthly invoice PDF in Xero. Make.com, Zapier or custom scripts are all fine. Include error alerts and a short runbook.", skills: ["Automation", "Zapier", "HubSpot", "Xero API", "Node.js"] }],
    Consulting: [{ title: "Digital transformation roadmap for a {industry}", desc: "We need an external consultant to interview three departments, map current processes, prioritise opportunities and produce a 12-month roadmap with a board-level summary. Weekly online check-ins.", skills: ["Consulting", "Process Mapping", "Roadmap", "Change Management"] }],
  },
  de: {
    "Web Development": [{ title: "Relaunch der Website für eine {industry} (responsiv, DSGVO-konform)", desc: "Unsere Website ist veraltet und auf dem Smartphone kaum nutzbar. Wir benötigen einen kompletten Relaunch mit ca. 15 Seiten, Blog (selbst pflegbar), Kontakt- und Terminformular, Google-Maps-Einbindung und DSGVO-konformem Cookie-Banner. Texte und Bilder liefern wir. Bitte Wartung nach dem Launch anbieten.", skills: ["WordPress", "Next.js", "Responsive Design", "DSGVO", "SEO"] }],
    SaaS: [{ title: "MVP einer B2B-SaaS-Lösung für {industry}-Prozesse", desc: "Wir möchten unsere internen Excel-Prozesse in eine mandantenfähige Webanwendung überführen und später an Partnerunternehmen vermarkten. Benötigt: Login, Kundenverwaltung mit Historie, Dashboard, CSV-Export, Rechnungsstellung. Technologie frei wählbar, wartbar und dokumentiert.", skills: ["TypeScript", "PostgreSQL", "Multi-tenant", "React"] }],
    AI: [{ title: "KI-Assistent für Kundenanfragen einer {industry}", desc: "Wir erhalten monatlich ca. 250 Anfragen per E-Mail und Chat. Der KI-Assistent soll auf Basis unserer FAQ und Preisliste antworten, bei Unsicherheit an einen Mitarbeiter übergeben und alle Gespräche protokollieren. Deutsch und Englisch erforderlich. Datenschutz ist uns wichtig (EU-Hosting bevorzugt).", skills: ["LLM", "RAG", "Python", "Chatbot", "Datenschutz"] }],
    Marketing: [{ title: "Performance-Marketing (Google & Meta Ads) für eine {industry}", desc: "Monatliche Betreuung: Google Ads und Meta Ads mit Budget von 4.000 €/Monat, Landingpage-Optimierung, monatliches Reporting mit Empfehlungen. Erfahrung im DACH-Markt erforderlich.", skills: ["Google Ads", "Meta Ads", "Conversion-Optimierung", "Reporting"] }],
    Design: [{ title: "Neues Corporate Design für eine {industry}", desc: "Logo, Farbwelt, Typografie, Geschäftsausstattung und ein kompaktes Styleguide-Dokument. Drei Entwürfe, zwei Korrekturrunden, Lieferung als AI/Figma-Dateien. Wirkung: hochwertig und vertrauenswürdig.", skills: ["Branding", "Logo Design", "Figma", "Illustrator"] }],
    Video: [{ title: "Imagefilm (60 Sek.) mit Social-Media-Schnitten für eine {industry}", desc: "Ein Drehtag vor Ort, Drehbuch- und Storyboard-Unterstützung, professioneller Schnitt, lizenzierte Musik, Untertitel (DE/EN). Lieferung: 60-Sek.-Hauptfilm und drei 15-Sek.-Hochkantversionen.", skills: ["Videoproduktion", "Schnitt", "Motion Graphics"] }],
    EC: [{ title: "Shopify-Shop mit ca. 100 Artikeln für eine {industry}", desc: "Aufbau eines Onlineshops auf Shopify: Theme-Anpassung, Produktimport per CSV, Zahlungsarten (PayPal, Klarna, Kreditkarte), Versandregeln, Abo-App, rechtssichere Texte (Impressum, Widerruf). Schulung für unser Team.", skills: ["Shopify", "E-Commerce", "Klarna", "Liquid"] }],
    SEO: [{ title: "SEO-Optimierung (technisch + Content) für eine {industry}-Website", desc: "Nach einem Relaunch sind unsere Rankings gesunken. Benötigt: technischer Audit, Umsetzung der Maßnahmen (Ladezeit, strukturierte Daten, interne Verlinkung), Keyword-Strategie und 6 Artikel-Briefings pro Monat. Start mit 3 Monaten.", skills: ["SEO", "Technisches SEO", "Content-Strategie"] }],
    Automation: [{ title: "Automatisierung Bestellung-bis-Rechnung für eine {industry} (HubSpot, Slack, DATEV)", desc: "Bestell-E-Mails automatisch im CRM anlegen, Slack-Benachrichtigung, monatliche Rechnungs-PDFs und DATEV-Export. Make oder eigene Skripte möglich. Fehlerbenachrichtigung und kurze Dokumentation erforderlich.", skills: ["Automatisierung", "Make", "HubSpot", "DATEV", "Node.js"] }],
    Consulting: [{ title: "Digitalisierungsstrategie und Roadmap für eine {industry}", desc: "Wir suchen externe Beratung: Interviews mit drei Abteilungen, Prozessaufnahme, Priorisierung, 12-Monats-Roadmap und Präsentation für die Geschäftsführung. Wöchentliche Online-Abstimmung.", skills: ["Beratung", "Prozessanalyse", "Roadmap", "Change Management"] }],
  },
  fr: {
    "Web Development": [{ title: "Refonte du site web d'une {industry} (responsive, RGPD)", desc: "Notre site actuel est ancien et peu lisible sur mobile. Nous souhaitons une refonte complète d'environ 12 pages avec un blog que nous pourrons mettre à jour, un formulaire de contact/prise de rendez-vous, l'intégration Google Maps et un bandeau cookies conforme au RGPD. Textes et photos fournis. Merci de proposer une période de maintenance après la mise en ligne.", skills: ["WordPress", "Next.js", "Responsive", "RGPD", "SEO"] }],
    SaaS: [{ title: "MVP d'un SaaS B2B pour les opérations d'une {industry}", desc: "Nous voulons transformer nos tableurs internes en application web multi-entreprises, à commercialiser ensuite. Fonctionnalités : authentification, gestion clients avec historique, tableau de bord, export CSV, facturation Stripe. Stack TypeScript de préférence, code documenté.", skills: ["TypeScript", "PostgreSQL", "Stripe", "Multi-tenant"] }],
    AI: [{ title: "Assistant IA pour les demandes clients d'une {industry}", desc: "Nous recevons environ 200 demandes par mois par e-mail et chat. L'assistant doit répondre à partir de notre FAQ et de nos tarifs, transférer à un humain en cas de doute et journaliser les conversations. Français et anglais requis. Hébergement en Europe souhaité.", skills: ["LLM", "RAG", "Python", "Chatbot"] }],
    Marketing: [{ title: "Gestion des campagnes Google & Meta Ads pour une {industry}", desc: "Prestation mensuelle : gestion Google Ads et Meta Ads (budget 3 500 €/mois), optimisation des pages d'atterrissage, rapport mensuel avec recommandations. Expérience du marché français exigée.", skills: ["Google Ads", "Meta Ads", "Optimisation de conversion", "Reporting"] }],
    Design: [{ title: "Nouvelle identité visuelle pour une {industry}", desc: "Logo, palette de couleurs, typographie, papeterie et charte graphique synthétique. Trois pistes créatives, deux séries de corrections, fichiers sources (AI/Figma). Esprit : élégant et chaleureux.", skills: ["Branding", "Logo", "Figma", "Illustrator"] }],
    Video: [{ title: "Film de marque 60 s + formats réseaux sociaux pour une {industry}", desc: "Une journée de tournage sur site, aide au script et storyboard, montage professionnel, musique libre de droits, sous-titres FR/EN. Livrables : film 60 s pour le site et trois versions verticales de 15 s.", skills: ["Production vidéo", "Montage", "Motion design"] }],
    EC: [{ title: "Boutique Shopify (~120 références) pour une {industry}", desc: "Création d'une boutique Shopify : personnalisation du thème, import produits CSV, paiements (Stripe, PayPal), règles de livraison, application d'abonnement, mentions légales. Formation de notre équipe incluse.", skills: ["Shopify", "E-commerce", "Liquid", "Paiement"] }],
    SEO: [{ title: "Audit SEO technique et stratégie de contenu pour une {industry}", desc: "Nos positions ont chuté après une migration. Besoin d'un audit technique complet, corrections (vitesse, données structurées, maillage), stratégie de mots-clés et 6 briefs d'articles par mois. Engagement initial de 3 mois.", skills: ["SEO", "SEO technique", "Stratégie de contenu"] }],
    Automation: [{ title: "Automatisation commande → facture pour une {industry} (HubSpot, Slack, Pennylane)", desc: "Créer automatiquement les commandes reçues par e-mail dans le CRM, notifier Slack, générer les factures PDF mensuelles et les exporter vers Pennylane. Make ou scripts sur mesure acceptés. Alertes d'erreur et documentation demandées.", skills: ["Automatisation", "Make", "HubSpot", "Node.js"] }],
    Consulting: [{ title: "Feuille de route de transformation digitale pour une {industry}", desc: "Nous recherchons un consultant externe : entretiens avec trois services, cartographie des processus, priorisation, feuille de route sur 12 mois et synthèse pour la direction. Point hebdomadaire en visio.", skills: ["Conseil", "Cartographie des processus", "Roadmap"] }],
  },
  es: {
    "Web Development": [{ title: "Rediseño web para una {industry} (responsive, RGPD)", desc: "Nuestra web actual es antigua y no se ve bien en móvil. Necesitamos un rediseño completo de unas 12 páginas con blog autogestionable, formulario de contacto y reserva de cita, integración de Google Maps y aviso de cookies conforme al RGPD. Textos y fotos los aportamos nosotros. Se valora un periodo de mantenimiento tras el lanzamiento.", skills: ["WordPress", "Next.js", "Responsive", "SEO"] }],
    SaaS: [{ title: "MVP de un SaaS B2B para la gestión de una {industry}", desc: "Queremos convertir nuestras hojas de cálculo internas en una aplicación web multiempresa para venderla después a negocios similares. Requisitos: autenticación, gestión de clientes con historial, panel de métricas, exportación CSV, facturación con Stripe. Preferimos TypeScript y código documentado.", skills: ["TypeScript", "PostgreSQL", "Stripe", "Multi-tenant"] }],
    AI: [{ title: "Asistente de IA para consultas de clientes de una {industry}", desc: "Recibimos unas 250 consultas al mes por correo y chat. El asistente debe responder a partir de nuestras FAQ y tarifas, derivar a una persona cuando no esté seguro y registrar todas las conversaciones. Español e inglés obligatorios.", skills: ["LLM", "RAG", "Python", "Chatbot"] }],
    Marketing: [{ title: "Gestión de Google Ads y Meta Ads para una {industry}", desc: "Servicio mensual: gestión de campañas (presupuesto 3.000 €/mes), optimización de landing pages, informe mensual con recomendaciones. Experiencia en el mercado español necesaria.", skills: ["Google Ads", "Meta Ads", "CRO", "Reporting"] }],
    Design: [{ title: "Nueva identidad de marca para una {industry}", desc: "Logotipo, paleta de colores, tipografía, papelería y manual de marca resumido. Tres propuestas, dos rondas de cambios, archivos fuente (AI/Figma). Estilo: elegante y cercano.", skills: ["Branding", "Logo", "Figma", "Illustrator"] }],
    Video: [{ title: "Vídeo corporativo de 60 s + piezas para redes de una {industry}", desc: "Un día de rodaje en nuestras instalaciones, apoyo en guion y storyboard, edición profesional, música con licencia, subtítulos ES/EN. Entregables: vídeo de 60 s para la web y tres piezas verticales de 15 s.", skills: ["Producción de vídeo", "Edición", "Motion graphics"] }],
    EC: [{ title: "Tienda Shopify con ~100 productos para una {industry}", desc: "Construcción de tienda online en Shopify: personalización de tema, importación de productos CSV, pagos (Stripe, PayPal, Bizum), reglas de envío, app de suscripción, textos legales. Formación para nuestro equipo.", skills: ["Shopify", "E-commerce", "Liquid", "Pagos"] }],
    SEO: [{ title: "SEO técnico y de contenidos para la web de una {industry}", desc: "Tras una migración, nuestras posiciones han bajado. Necesitamos auditoría técnica completa, correcciones (velocidad, datos estructurados, enlazado interno), estrategia de palabras clave y 6 briefs de artículos al mes. Contrato inicial de 3 meses.", skills: ["SEO", "SEO técnico", "Estrategia de contenidos"] }],
    Automation: [{ title: "Automatización pedido → factura para una {industry} (HubSpot, Slack, Holded)", desc: "Registrar automáticamente los pedidos recibidos por correo en el CRM, avisar en Slack, generar facturas PDF mensuales y exportarlas a Holded. Make o scripts a medida. Alertas de error y documentación breve.", skills: ["Automatización", "Make", "HubSpot", "Node.js"] }],
    Consulting: [{ title: "Hoja de ruta de transformación digital para una {industry}", desc: "Buscamos consultoría externa: entrevistas con tres departamentos, mapeo de procesos, priorización, hoja de ruta a 12 meses y resumen para dirección. Reunión semanal online.", skills: ["Consultoría", "Mapeo de procesos", "Roadmap"] }],
  },
  ko: {
    "Web Development": [{ title: "{industry} 홈페이지 리뉴얼 (반응형, 예약 기능)", desc: "현재 홈페이지가 오래되어 모바일에서 레이아웃이 깨집니다. 약 12페이지 전면 리뉴얼, 자체 관리 가능한 블로그/공지 기능, 상담·예약 폼, 네이버/구글 지도 연동을 원합니다. 원고와 사진은 제공합니다. 오픈 후 유지보수 기간 포함 제안 부탁드립니다.", skills: ["Next.js", "WordPress", "반응형", "SEO"] }],
    SaaS: [{ title: "{industry} 운영을 위한 B2B SaaS MVP 개발", desc: "사내 엑셀 관리 업무를 웹 애플리케이션으로 전환하고, 향후 동종 업체에 판매하려고 합니다. 로그인, 조직/팀, 고객 이력 관리, 대시보드, CSV 내보내기, 결제 연동이 필요합니다. 멀티테넌트 구조로 설계해 주세요. TypeScript 선호.", skills: ["TypeScript", "PostgreSQL", "Multi-tenant", "React"] }],
    AI: [{ title: "{industry} 고객 문의 AI 챗봇 구축", desc: "월 300건 이상의 이메일·채팅 문의를 AI로 자동 응대하고 싶습니다. FAQ(약 100건)와 요금 안내 기반으로 답변하고, 불확실한 경우 담당자에게 전달, 모든 대화 로그를 관리자 화면에서 확인할 수 있어야 합니다. 한국어·영어 지원 필수.", skills: ["LLM", "RAG", "Python", "Chatbot"] }],
    Marketing: [{ title: "{industry} 인스타그램·네이버 광고 운영 대행", desc: "월 단위 운영 대행: 인스타그램 콘텐츠 주 3회, 네이버 검색광고 및 메타 광고 운영(월 예산 400만원), 월간 리포트 제출. 뷰티·헬스케어 분야 경험자 우대.", skills: ["Instagram", "네이버 광고", "Meta Ads", "콘텐츠 마케팅"] }],
    Design: [{ title: "{industry} 브랜드 로고 및 BI 디자인", desc: "리브랜딩에 따라 로고, 컬러 팔레트, 타이포그래피, 명함, 간단한 브랜드 가이드라인 제작을 의뢰합니다. 시안 3개, 수정 2회, 원본 파일(AI/Figma) 납품. 고급스럽고 친근한 느낌을 원합니다.", skills: ["Branding", "Logo Design", "Figma", "Illustrator"] }],
    Video: [{ title: "{industry} 브랜드 영상 제작 (60초 + SNS용 컷)", desc: "홈페이지 메인용 60초 브랜드 영상과 인스타그램/틱톡용 15초 세로 영상 3편. 서울 내 1일 촬영, 내레이션·BGM 포함, 한/영 자막 필요.", skills: ["영상 제작", "편집", "모션그래픽"] }],
    EC: [{ title: "{industry} 쇼핑몰 구축 (Cafe24 또는 Shopify, 약 100개 상품)", desc: "오프라인 상품을 온라인 판매하기 위한 쇼핑몰 구축. 상품 등록(CSV 제공), 결제(카드·네이버페이·카카오페이), 배송 설정, 정기구독 기능, 기본 디자인 커스터마이징. 직원 교육 포함.", skills: ["Cafe24", "Shopify", "E-commerce", "결제 연동"] }],
    SEO: [{ title: "{industry} 웹사이트 검색 최적화 (네이버·구글)", desc: "검색 순위가 하락하여 원인 분석과 개선이 필요합니다. 기술 진단, 속도·구조화 데이터 개선, 키워드 전략, 월 8건 콘텐츠 기획. 3개월 계약 후 성과에 따라 연장.", skills: ["SEO", "네이버 SEO", "콘텐츠 전략"] }],
    Automation: [{ title: "주문~청구 업무 자동화 ({industry}, 슬랙·구글시트 연동)", desc: "주문 이메일을 자동으로 구글시트/CRM에 등록하고 슬랙으로 알림, 월말 청구서 PDF 자동 생성. Make/Zapier 또는 스크립트 모두 가능. 운영 매뉴얼 작성 포함.", skills: ["자동화", "Zapier", "Slack API", "Python"] }],
    Consulting: [{ title: "{industry} DX 전략 수립 및 로드맵", desc: "업무 디지털화를 추진하고 싶지만 우선순위가 정리되지 않았습니다. 3개 부서 인터뷰, 과제 정리, 우선순위, 12개월 로드맵, 경영진 보고자료 작성. 주 1회 온라인 미팅.", skills: ["DX", "컨설팅", "로드맵", "업무 분석"] }],
  },
};

/** Budget ranges (USD) per category — converted to local currency */
const BUDGET_USD: Record<string, [number, number]> = {
  "Web Development": [1500, 9000], SaaS: [6000, 40000], AI: [3000, 25000], Marketing: [1500, 8000], Design: [800, 5000],
  Video: [1200, 7000], EC: [2000, 12000], SEO: [1200, 6000], Automation: [1500, 9000], Consulting: [2500, 15000],
};
const FX: Record<string, number> = { USD: 1, JPY: 150, GBP: 0.79, EUR: 0.92, SGD: 1.35, AUD: 1.52, KRW: 1370 };

/** Scripted client persona: the sequence of reply categories the fake client will send */
export const PERSONAS: string[][] = [
  ["INTERESTED", "PRICE_NEGOTIATION", "ACCEPTANCE"],
  ["QUESTION", "REQUEST_MEETING", "ACCEPTANCE"],
  ["TECHNICAL_QUESTION", "PRICE_NEGOTIATION", "SCHEDULE_NEGOTIATION", "ACCEPTANCE"],
  ["REQUEST_PORTFOLIO", "INTERESTED", "ACCEPTANCE"],
  ["PRICE_NEGOTIATION", "PRICE_NEGOTIATION", "REJECTION"],
  ["OBJECTION", "QUESTION", "ACCEPTANCE"],
  ["REJECTION"],
  ["INTERESTED", "SCHEDULE_NEGOTIATION", "ACCEPTANCE"],
  ["QUESTION", "PRICE_NEGOTIATION", "ACCEPTANCE"],
  ["REQUEST_MEETING", "ACCEPTANCE"],
];

function roundLocal(v: number, currency: string) {
  if (currency === "JPY" || currency === "KRW") return Math.round(v / 1000) * 1000;
  return Math.round(v / 50) * 50;
}

export function generateDemoJobs(count = 100, now = new Date("2026-09-01T00:00:00Z")): NormalizedJob[] {
  const jobs: NormalizedJob[] = [];
  for (let i = 0; i < count; i++) {
    const country = DEMO_COUNTRIES[i % DEMO_COUNTRIES.length];
    const category = DEMO_CATEGORIES[Math.floor(i / DEMO_COUNTRIES.length) % DEMO_CATEGORIES.length === 0 && i >= 90 ? i % DEMO_CATEGORIES.length : (i * 7) % DEMO_CATEGORIES.length];
    const lang = country.lang;
    const tpls = TEMPLATES[lang][category] ?? TEMPLATES.en[category];
    const seed = hashString(`demo-${i}-${country.code}-${category}`);
    const tpl = tpls[seed % tpls.length];
    const pair = CLIENTS[country.code][(seed >>> 3) % CLIENTS[country.code].length];
    const clientName = pair[0];
    const industry = pair[1];
    const [lo, hi] = BUDGET_USD[category];
    const spread = (seed % 100) / 100;
    const baseUsd = lo + (hi - lo) * spread;
    const fx = FX[country.currency];
    const minLocal = roundLocal(baseUsd * fx * 0.8, country.currency);
    const maxLocal = roundLocal(baseUsd * fx * 1.2, country.currency);
    const postedDaysAgo = seed % 21;
    const postedAt = new Date(now.getTime() - postedDaysAgo * 86400000 - ((seed >>> 5) % 24) * 3600000);
    const proposalDeadline = new Date(postedAt.getTime() + (7 + (seed % 14)) * 86400000);
    const deadline = new Date(postedAt.getTime() + (30 + (seed % 90)) * 86400000);
    const rating = Math.round((3.2 + ((seed >>> 7) % 19) / 10) * 10) / 10; // 3.2–5.0
    const persona = PERSONAS[(seed >>> 2) % PERSONAS.length];
    const title = tpl.title.replace("{industry}", industry);
    const desc = tpl.desc.replace(/\{industry\}/g, industry);
    const paymentVerified = (seed >>> 4) % 5 !== 0;
    jobs.push(
      normalizeJob("demo-marketplace", {
        job_id: `DEMO-${String(i + 1).padStart(3, "0")}`,
        job_url: `https://demo-marketplace.local/jobs/DEMO-${String(i + 1).padStart(3, "0")}`,
        client_name: clientName,
        client_country: country.code,
        client_language: lang,
        project_title: title,
        project_description: desc,
        category,
        required_skills: tpl.skills,
        budget_min: minLocal,
        budget_max: maxLocal,
        currency: country.currency,
        deadline: deadline.toISOString(),
        proposal_deadline: proposalDeadline.toISOString(),
        number_of_competitors: 2 + ((seed >>> 6) % 40),
        client_rating: (seed >>> 9) % 7 === 0 ? null : Math.min(5, rating),
        client_history: `${1 + ((seed >>> 8) % 30)} past projects, ${(seed >>> 10) % 100}% hire rate`,
        payment_verified: paymentVerified,
        posted_at: postedAt.toISOString(),
        raw_text: `${title}\n\n${desc}`,
        source_metadata: { persona, industry, timezone: country.tz, demo: true },
      }),
    );
  }
  return jobs;
}
