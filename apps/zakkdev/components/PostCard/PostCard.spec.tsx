import { render } from '@testing-library/react';

import PostCard from './PostCard';

describe('PostCard', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<PostCard />);
    expect(baseElement).toBeTruthy();
  });
});
