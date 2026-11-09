import { Navigate, useParams } from 'react-router-dom';

/** On the website a kommun's chat is on its page, as before */
const ChatRedirect = () => {
  const { slug = '' } = useParams();
  return <Navigate to={`/kommun/${slug}?chatt=1`} replace />;
};

export default ChatRedirect;
