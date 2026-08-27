/**
 * Atelierul Financiar — captură locală rapidă. Șabloanele completează un formular,
 * iar salvarea unei mișcări rămâne întotdeauna o confirmare separată.
 */
import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Check, Plus, Trash2, X } from "lucide-react";
import { expenseCategories, isoToday, newId, parseRomanianAmount, sourceBalance, type AppData, type QuickTransactionTemplate, type Transaction, type TransactionKind } from "@/lib/finance-data";

const money = new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON", maximumFractionDigits: 0 });

type Props = { data: AppData; onSave: (item: Transaction) => void; onClose: () => void; onMore: () => void; onSaveTemplate: (item: QuickTransactionTemplate) => void; onDeleteTemplate: (id: string) => void };

export function QuickEntryPanel({ data, onSave, onClose, onMore, onSaveTemplate, onDeleteTemplate }: Props) {
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Alimente");
  const [memberId, setMemberId] = useState(data.settings.members[0]?.id || "");
  const [sourceId, setSourceId] = useState(data.settings.paymentSources[0]?.id || "");
  const [templateId, setTemplateId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [error, setError] = useState("");
  const sources = useMemo(() => data.settings.paymentSources.filter((source) => !source.memberId || source.memberId === memberId), [data.settings.paymentSources, memberId]);
  const activeTemplate = data.settings.quickTemplates.find((item) => item.id === templateId);

  useEffect(() => { if (!sources.some((source) => source.id === sourceId)) setSourceId(sources[0]?.id || ""); }, [sourceId, sources]);

  const chooseManual = () => { setTemplateId(""); setTemplateLabel(""); setError(""); };
  const selectTemplate = (template: QuickTransactionTemplate) => { setTemplateId(template.id); setKind(template.kind); setCategory(template.category); setAmount(template.amount ? String(template.amount) : ""); if (template.memberId) setMemberId(template.memberId); if (template.sourceId) setSourceId(template.sourceId); setTemplateLabel(template.label); setError(""); };
  const save = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId);
    if (numeric <= 0) return setError("Introdu o sumă mai mare decât zero.");
    if (!member || !source || (source.memberId && source.memberId !== member.id)) return setError("Alege un membru și o sursă de plată compatibile.");
    onSave({ id: newId("tx"), title: activeTemplate?.label || (kind === "expense" ? `Cheltuială rapidă · ${category}` : "Venit rapid"), amount: numeric, kind, category: kind === "expense" ? category : "Venit", sourceId: source.id, source: source.name, memberId: member.id, person: member.name, date: isoToday(), allocationId: kind === "expense" ? "outside" : undefined, createdAt: new Date().toISOString() });
    onClose();
  };
  const remember = () => {
    const numeric = parseRomanianAmount(amount); const member = data.settings.members.find((item) => item.id === memberId); const source = data.settings.paymentSources.find((item) => item.id === sourceId); const label = templateLabel.trim() || (kind === "expense" ? category : "Venit rapid");
    if (!member || !source) return setError("Alege membrul și sursa înainte de salvarea șablonului.");
    onSaveTemplate({ id: templateId || newId("quick-template"), label, kind, category: kind === "expense" ? category : "Venit", amount: Math.max(0, numeric), memberId: member.id, sourceId: source.id, updatedAt: new Date().toISOString() });
    setTemplateLabel(label); setError("");
  };
  const remove = () => { if (!templateId) return; if (!window.confirm(`Ștergi șablonul local „${activeTemplate?.label || "acesta"}”? Tranzacțiile rămân neschimbate.`)) return; onDeleteTemplate(templateId); chooseManual(); };

  return <div className="bf-modal-backdrop" role="presentation" onMouseDown={onClose}><section className="bf-modal bf-quick-entry-panel" role="dialog" aria-modal="true" aria-label="Înregistrare rapidă" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="bf-kicker">CAPTURĂ ÎN CÂTEVA SECUNDE</p><h2>Înregistrare rapidă</h2></div><button className="bf-icon-button" aria-label="Închide" onClick={onClose}><X size={19} /></button></header><p className="bf-quick-entry-intro">Salvezi o mișcare reală cu data de azi. Alege un șablon sau completează manual.</p>{data.settings.quickTemplates.length > 0 && <div className="bf-quick-template-rail" role="list" aria-label="Șabloane locale"><button role="listitem" className={!templateId ? "active" : ""} onClick={chooseManual}>Manual</button>{data.settings.quickTemplates.map((item) => <button role="listitem" key={item.id} className={templateId === item.id ? "active" : ""} onClick={() => selectTemplate(item)}><b>{item.label}</b><small>{item.amount ? money.format(item.amount) : "sumă liberă"}</small></button>)}</div>}<div className="bf-segment"><button className={kind === "expense" ? "active expense" : ""} onClick={() => setKind("expense")}>Cheltuială</button><button className={kind === "income" ? "active income" : ""} onClick={() => setKind("income")}>Venit</button></div><div className="bf-quick-entry-grid"><label className="bf-field"><span>Sumă (lei)</span><input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" /></label>{kind === "expense" && <label className="bf-field"><span>Categorie</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{[...expenseCategories, ...data.settings.customCategories].map((item) => <option key={item}>{item}</option>)}</select></label>}<label className="bf-field"><span>Cine</span><select value={memberId} onChange={(event) => setMemberId(event.target.value)}>{data.settings.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><label className="bf-field"><span>{kind === "expense" ? "Plătit din" : "Încasat în"}</span><select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} · {money.format(sourceBalance(data, source.id))}</option>)}</select></label></div>{kind === "expense" && <p className="bf-quick-entry-note">Această salvare rapidă nu consumă un plic. Pentru plic, notiță sau altă dată, folosește formularul complet.</p>}<details className="bf-template-save"><summary><BookmarkPlus size={16} /> {templateId ? "Editează șablonul selectat" : "Salvează combinația ca șablon local"}</summary><label className="bf-field"><span>Nume șablon</span><input value={templateLabel} onChange={(event) => setTemplateLabel(event.target.value)} placeholder="ex. Taxi serviciu" /></label><div className="bf-template-actions"><button type="button" onClick={remember}>{templateId ? "Actualizează șablonul" : "Păstrează pe acest telefon"}</button>{templateId && <button type="button" className="danger" onClick={remove}><Trash2 size={15} /> Șterge</button>}</div></details>{error && <p className="bf-form-error" role="alert">{error}</p>}<button className="bf-primary full" onClick={save}><Check size={17} /> Salvează acum</button><button className="bf-quick-entry-more" onClick={onMore}><Plus size={16} /> Adaugă plic, notiță sau altă dată</button></section></div>;
}
