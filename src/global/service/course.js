export default {
  course: () => {
    return Promise.resolve({
      cover_url: null,
      current_price: '120.00',
      heart_count: 24,
      id: 1,
      name: '一门价值百万的课程'
    })
  },
  data:()=>{return '为什么？'},
  series: () => {
    return Promise.resolve({
      cover_url: null,
      current_price: '220.00',
      heart_count: 880,
      id: 1,
      name: 'JavaScript 设计指南'
    })
  }
}
