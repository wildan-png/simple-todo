import TodoApp from '@/app/components/TodoApp';

export default function Home() {
  return (
    <main className="flex flex-col flex-1 px-4 md:px-8 py-6 md:py-4 w-full md:overflow-hidden">
      <TodoApp />
    </main>
  );
}
