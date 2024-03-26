import router from '@/router'

export const goPage = (routeName = 'Home', params = {}, query = {}, type = '_self') => {
  goRoute(
    {
      name: routeName,
      params,
      query
    },
    type
  )
}

//route为目标路由信息，type为跳转类型
export const goRoute = (route, type = '_self') => {
  //使用路由实例的currentRoute属性获取当前路由对象，判断当前路由的名称是否与目标路由的名称不相等。
  router.currentRoute.value.name !== route.name &&
    //判断是否需要进行路由替换操作。
    (type === 'replace'
        ? router.replace(route)
        //如果不是替换类型的跳转，判断type是否不等于'_self
        : type !== '_self'
            //type不等于'_self'，即需要在新窗口中打开页面，检查目标路由信息route是否为对象类型
            ? typeof route === 'object'
                //如果是对象类型，则表示使用路由的解析功能获取目标路由的URL
                ? window.open(router.resolve(route).href, type)
                //如果目标路由信息不是对象类型，直接将route作为URL，在新窗口中打开目标页面。
                : window.open(route, type)
            //type等于'_self'，执行路由的正常跳转，使用路由实例的push方法将页面导航到目标路由。
            : router.push(route))
}
