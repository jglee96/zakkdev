import type { Meta } from '@storybook/react';
import { TopicButton, TopicButtonProps } from './topic-button';
import { useState } from 'react';

const Story: Meta<typeof TopicButton> = {
  component: TopicButton,
  title: 'TopicButton',
  argTypes: {
    onClick: { action: 'onClick executed' },
  },
};
export default Story;

const Template = (args: TopicButtonProps) => {
  const [clickedTopic, setClickedTopic] = useState<string | null>(null);
  return (
    <div className="bg-gray-300 p-20">
      <TopicButton
        {...args}
        onClick={(topicName) => setClickedTopic(topicName)}
      />
      {clickedTopic && (
        <div data-testid="click-result">
          Button has been clicked: {clickedTopic}
        </div>
      )}
    </div>
  );
};

export const Primary = {
  args: { topicName: 'Next.js' },
  render: (args: TopicButtonProps) => <Template {...args} />,
};
