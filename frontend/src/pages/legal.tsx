import { Link } from "react-router-dom";

/**
 * Privacy policy and terms.
 *
 * These describe what the site actually does today: it collects a name, phone,
 * wilaya and address when someone places an order, stores them so the order can
 * be fulfilled, and hands the conversation to WhatsApp. It sets no cookies and
 * runs no analytics. Keep this file in step with the code — a policy that
 * describes behaviour the site does not have is worse than none.
 */

const WHATSAPP =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? "213777887762";
const CONTACT_URL = `https://wa.me/${WHATSAPP}`;

const UPDATED = "سبتمبر 2026";

function Shell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-12">
      <div className="flex flex-col gap-3">
        <Link
          to="/"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m9 18 6-6-6-6" />
          </svg>
          الرئيسية
        </Link>
        <div className="flex items-start gap-3">
          <span className="mt-1.5 h-7 w-1 rounded-full bg-gold" />
          <div>
            <h1 className="font-heading text-3xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              آخر تحديث: {UPDATED}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-7 leading-loose text-foreground/85">
        {children}
      </div>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-lg font-bold text-foreground">{heading}</h2>
      {children}
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pe-5">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

// ── Privacy ──────────────────────────────────────────────

export function PrivacyPage() {
  return (
    <Shell
      title="سياسة الخصوصية"
      subtitle="ما الذي نجمعه من بياناتك، ولماذا، وكيف يمكنك التحكم فيه."
    >
      <Section heading="من نحن">
        <p>
          مكتبة البيان، مكتبة متخصصة في الكتب الشرعية والعلوم الإسلامية والمراجع
          الأكاديمية في الجزائر. هذه السياسة تشرح كيف نتعامل مع بياناتك الشخصية
          عند استعمالك لهذا الموقع.
        </p>
      </Section>

      <Section heading="ما الذي نجمعه">
        <p>
          لا نطلب منك إنشاء حساب، ولا نجمع أي بيانات لمجرد تصفّح الموقع. نجمع
          البيانات التالية فقط عندما تُرسل طلب كتاب بنفسك:
        </p>
        <Bullets
          items={[
            "الاسم واللقب",
            "رقم الهاتف",
            "الولاية والعنوان",
            "الكتاب المطلوب",
          ]}
        />
      </Section>

      <Section heading="لماذا نجمعها">
        <p>
          لهدف واحد: تحضير طلبك، والتواصل معك لتأكيده، وتوصيله إليك. لا نستعمل
          بياناتك لأي غرض آخر، ولا نرسل لك رسائل إعلانية.
        </p>
      </Section>

      <Section heading="ملفات تعريف الارتباط (Cookies) والتتبّع">
        <p>
          هذا الموقع <strong>لا يستعمل ملفات تعريف الارتباط</strong>، ولا أدوات
          تحليل أو تتبّع، ولا أي إعلانات. الخطوط المستعملة في التصميم مُستضافة
          على خوادمنا، فلا يُرسَل عنوان IP الخاص بك إلى أي طرف ثالث لمجرد فتح
          الصفحة.
        </p>
      </Section>

      <Section heading="واتساب">
        <p>
          بعد تسجيل طلبك عندنا، يفتح الموقع محادثة واتساب لإتمام التأكيد. عند
          هذه النقطة تصبح المحادثة خاضعة لسياسة خصوصية واتساب (Meta)، وهي خارجة
          عن سيطرتنا. أنت لست ملزمًا بمتابعة المحادثة، وطلبك يبقى مسجّلًا لدينا
          في كل الأحوال.
        </p>
      </Section>

      <Section heading="أين تُخزَّن بياناتك">
        <p>
          يعتمد الموقع على مزوّدي خدمات سحابية لاستضافة التطبيق وقاعدة البيانات
          وصور الأغلفة. وهذا يعني أن بياناتك قد تُخزَّن أو تُعالَج على خوادم
          خارج الجزائر. نختار مزوّدين معروفين ونقتصر على أقل قدر ممكن من
          البيانات.
        </p>
      </Section>

      <Section heading="مدّة الاحتفاظ">
        <p>
          نحتفظ ببيانات الطلب ما دامت لازمة لتنفيذه ولحفظ سجلّ المعاملات. يمكنك
          أن تطلب حذف بياناتك في أي وقت.
        </p>
      </Section>

      <Section heading="حقوقك">
        <p>لك الحق في أن:</p>
        <Bullets
          items={[
            "تطّلع على البيانات التي نحتفظ بها عنك",
            "تصحّح أي بيان خاطئ",
            "تطلب حذف بياناتك",
            "تعترض على استعمالها",
          ]}
        />
        <p>
          لممارسة أي من هذه الحقوق، تواصل معنا عبر{" "}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            واتساب
          </a>
          . نردّ في أقرب وقت ممكن.
        </p>
      </Section>

      <Section heading="الأطفال">
        <p>
          الموقع موجّه للبالغين. لا نجمع عن قصد بيانات من أطفال دون السنّ
          القانونية. إن وصلتنا مثل هذه البيانات، نحذفها فور علمنا بذلك.
        </p>
      </Section>

      <Section heading="تعديلات على هذه السياسة">
        <p>
          قد نحدّث هذه الصفحة كلما تغيّرت طريقة عمل الموقع. التاريخ في أعلى
          الصفحة يوضّح آخر تحديث.
        </p>
      </Section>
    </Shell>
  );
}

// ── Terms ────────────────────────────────────────────────

export function TermsPage() {
  return (
    <Shell
      title="شروط الاستخدام"
      subtitle="القواعد التي تحكم استعمال الموقع وطلب الكتب منه."
    >
      <Section heading="قبول الشروط">
        <p>
          باستعمالك لهذا الموقع أو بإرسالك طلب كتاب، فإنك توافق على الشروط
          الواردة في هذه الصفحة. إن كنت لا توافق عليها، يُرجى عدم استعمال
          الموقع.
        </p>
      </Section>

      <Section heading="كيف يتمّ الطلب">
        <p>
          إرسال النموذج على هذا الموقع هو <strong>طلب</strong> وليس عقد بيع
          نهائيًا. يصبح الطلب مؤكَّدًا فقط بعد أن نتواصل معك ونؤكّد توفّر الكتاب
          والسعر وتفاصيل التوصيل. نحتفظ بحق رفض أي طلب.
        </p>
      </Section>

      <Section heading="الأسعار والتوفّر">
        <p>
          الأسعار معروضة بالدينار الجزائري وقد تتغيّر دون إشعار مسبق. نبذل ما في
          وسعنا لإبقاء بيانات الكتب والتوفّر دقيقة، لكن قد يَنفد كتاب أو يحمل
          خطأً في العرض. في هذه الحالة نُعلمك قبل أي التزام.
        </p>
      </Section>

      <Section heading="الدفع والتوصيل">
        <Bullets
          items={[
            "الدفع عند الاستلام.",
            "التوصيل متاح إلى جميع الولايات الـ58.",
            "مدّة التوصيل تقديرية وتختلف حسب الولاية وشركة التوصيل.",
            "تكاليف التوصيل تُبلَّغ لك عند التأكيد.",
          ]}
        />
      </Section>

      <Section heading="الإلغاء والإرجاع">
        <p>
          يمكنك إلغاء الطلب قبل شحنه بالتواصل معنا. إذا وصلك كتاب تالف أو مخالف
          لما طلبته، تواصل معنا فورًا وسنستبدله أو نُلغي الطلب. لا تُقبل
          الإرجاعات الناتجة عن تغيير الرأي بعد الاستلام.
        </p>
      </Section>

      <Section heading="استعمال الموقع">
        <p>
          يُمنع استعمال الموقع لإرسال طلبات وهمية أو مسيئة، أو لمحاولة تعطيله أو
          الوصول إلى أجزاء غير متاحة للعموم منه.
        </p>
      </Section>

      <Section heading="الملكية الفكرية">
        <p>
          اسم المكتبة وشعارها وتصميم الموقع مملوكة لنا. أما عناوين الكتب وأسماء
          المؤلفين ودور النشر وصور الأغلفة فهي ملك لأصحابها، وتُعرض هنا للتعريف
          بالكتب المتاحة للبيع.
        </p>
      </Section>

      <Section heading="حدود المسؤولية">
        <p>
          نقدّم الموقع كما هو. لا نضمن أن يكون متاحًا دون انقطاع أو خاليًا من
          الأخطاء. مسؤوليتنا تنحصر في الطلب المتّفق عليه معك.
        </p>
      </Section>

      <Section heading="القانون المطبَّق">
        <p>
          تخضع هذه الشروط للقانون الجزائري، وتُعرض أي منازعة على الجهات القضائية
          المختصة في الجزائر.
        </p>
      </Section>

      <Section heading="التواصل">
        <p>
          لأي سؤال حول هذه الشروط، تواصل معنا عبر{" "}
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            واتساب
          </a>
          .
        </p>
      </Section>
    </Shell>
  );
}
