import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '../../components/common/Pagination'

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  });

  it('renders nothing when totalPages is 0', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={0} onPageChange={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  });

  it('renders page buttons when there are multiple pages', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  });

  it('disables the Prev button on the first page', () => {
    render(<Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByText('Prev')).toBeDisabled()
  });

  it('disables the Next button on the last page', () => {
    render(<Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />)
    expect(screen.getByText('Next')).toBeDisabled()
  });

  it('calls onPageChange with the next page when Next is clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByText('Next'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  });

  it('calls onPageChange with the previous page when Prev is clicked', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByText('Prev'))
    expect(onPageChange).toHaveBeenCalledWith(1)
  });

  it('calls onPageChange with the clicked page number', () => {
    const onPageChange = vi.fn()
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByText('3'))
    expect(onPageChange).toHaveBeenCalledWith(3)
  });

  it('shows ellipsis and first/last page links when there are many pages', () => {
    render(<Pagination currentPage={10} totalPages={20} onPageChange={() => {}} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
  });
})