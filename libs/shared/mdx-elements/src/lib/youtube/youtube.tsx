import styles from './youtube.module.css';

export interface YoutubeProps {
  title: string;
  uid: string;
}

export function Youtube(props: YoutubeProps) {
  return (
    <div>
      <iframe
        src={`https://www.youtube.com/embed/${props.uid}`}
        width="100%"
        height="500px"
        title={props.title}
      />
    </div>
  );
}

export default Youtube;
