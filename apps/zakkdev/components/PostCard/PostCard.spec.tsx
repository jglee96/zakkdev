import { render } from '@testing-library/react';

import PostCard from './PostCard';

describe('PostCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <PostCard
        fileName="Acronym Naming"
        frontMatter={{
          title: 'Acronym Naming',
          date: '2023-03-24T13:55:57.000Z',
          author: { name: 'zakklee' },
        }}
      />
    );
    expect(baseElement).toBeTruthy();
  });
});
