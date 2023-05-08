import type { Meta } from '@storybook/react';
import { TopicButton, TopicButtonProps } from './topic-button';

const Story: Meta<typeof TopicButton> = {
  component: TopicButton,
  title: 'TopicButton',
};
export default Story;

export const Primary = {
  args: {},
  render: (args: TopicButtonProps) => (
    <div className="bg-gray-300 p-20">
      <TopicButton {...args} />
    </div>
  ),
};
