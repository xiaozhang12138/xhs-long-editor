import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TitleInput } from '../src/components/editor/TitleInput';

afterEach(cleanup);

/** 受控包装组件，模拟真实使用（App 通过 store 回写 value） */
const ControlledTitle: React.FC<{ initial?: string }> = ({ initial = '' }) => {
  const [v, setV] = useState(initial);
  return <TitleInput value={v} onChange={setV} />;
};

/**
 * T1 - 标题字数限制（上限 64）
 */
describe('TitleInput 标题字数限制', () => {
  it('初始为空时计数器显示 0/64', () => {
    render(<ControlledTitle />);
    expect(screen.getByText('0/64')).toBeTruthy();
  });

  it('输入 10 字时计数器显示 10/64 且不是超限色', () => {
    render(<ControlledTitle />);
    const input = screen.getByPlaceholderText('填写标题') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '一'.repeat(10) } });

    const counter = screen.getByText('10/64');
    expect(counter).toBeTruthy();
    expect(counter.className).toContain('text-[#999]');
    expect(counter.className).not.toContain('text-[#FF2442]');
  });

  it('恰好 64 字为边界内，不触发超限状态', () => {
    render(<ControlledTitle />);
    const input = screen.getByPlaceholderText('填写标题') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '字'.repeat(64) } });

    const counter = screen.getByText('64/64');
    expect(counter).toBeTruthy();
    expect(counter.className).toContain('text-[#999]');
  });

  it('超过 64 字（65 字）时计数器显示 65/64 并切换为红色超限态', () => {
    render(<ControlledTitle />);
    const input = screen.getByPlaceholderText('填写标题') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '字'.repeat(65) } });

    const counter = screen.getByText('65/64');
    expect(counter).toBeTruthy();
    // 超限必须有红色告警样式
    expect(counter.className).toContain('text-[#FF2442]');
  });

  it('onChange 会把完整输入值透传给上层 store', () => {
    const onChange = vi.fn();
    render(<TitleInput value="" onChange={onChange} />);
    const input = screen.getByPlaceholderText('填写标题') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '小红书长文标题' } });
    expect(onChange).toHaveBeenCalledWith('小红书长文标题');
  });

  it('input 的硬性 maxLength 大于 64，保证「可超限并提示」而非直接截断', () => {
    render(<ControlledTitle />);
    const input = screen.getByPlaceholderText('填写标题') as HTMLInputElement;
    expect(Number(input.getAttribute('maxLength'))).toBeGreaterThan(64);
  });
});
