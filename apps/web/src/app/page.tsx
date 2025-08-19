import dynamic from 'next/dynamic';

const SimplePage = dynamic(() => import('./simple'), {
  ssr: false
});

export default function HomePage() {
  return <SimplePage />;
}