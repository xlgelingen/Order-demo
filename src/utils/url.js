import router from '@/router'

export const getAlipayReturnUrl = (resource_type = '',id,ORDER_TYPE_COURSE, ORDER_TYPE_COURSE_SERIES,ORDER_TYPE_VIP) => {
  let url = window.location.protocol + '//' + window.location.host
  switch (resource_type) {
    case ORDER_TYPE_COURSE:
      url += router.resolve({
        name: 'AcademyCourseDetail',
        params: {
          id: id
        }
      }).href
      break
    case ORDER_TYPE_COURSE_SERIES:
      url += router.resolve({
        name: 'AcademySeriesDetail',
        params: {
          id: id
        }
      }).href
      break
    case ORDER_TYPE_VIP:
      url += router.resolve({
        name: 'MyPurchase'
      }).href
      break
    default:
      break
  }
  return url
}
