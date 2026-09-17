import Card from "./Card";

export default function SelectorBar({ disciplines, selDiscipline, setSelDiscipline, selCategory, setSelCategory, children }) {
  const discipline = disciplines.find((d) => d.id === selDiscipline);
  return (
    <div>
      <Card className="p-4 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Disciplina</label>
          <select
            className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm min-w-[220px]"
            value={selDiscipline}
            onChange={(e) => setSelDiscipline(e.target.value)}
          >
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        {discipline && (
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Categoría</label>
            <select
              className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm min-w-[220px]"
              value={selCategory}
              onChange={(e) => setSelCategory(e.target.value)}
            >
              {discipline.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </Card>
      {children}
    </div>
  );
}
