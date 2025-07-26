  const roleMiddleware = (role) => {
    return (req, res, next) => {
      console.log("user role in rolemiddleware",req.user.role);
      if (req.user.role !== role) {
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
      }
      next();
    };
  };

  module.exports = roleMiddleware;
