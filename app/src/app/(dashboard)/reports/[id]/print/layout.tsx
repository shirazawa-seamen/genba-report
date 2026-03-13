export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="m-0 bg-white p-0 text-black">{children}</div>;
}
