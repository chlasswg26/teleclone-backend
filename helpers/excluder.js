const exclude = (obj, keys) => obj !== Object(obj)
  ? obj
  : Array.isArray(obj)
    ? obj.map((item) => exclude(item, keys))
    : Object.keys(obj)
      .filter((k) => !keys.includes(k))
      .reduce(
        (acc, x) => Object.assign(acc, { [x]: exclude(obj[x], keys) }),
        {}
      )

module.exports = exclude
